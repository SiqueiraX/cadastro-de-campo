import { neon } from '@neondatabase/serverless';
if (!process.env.DATABASE_URL || !process.env.ADMIN_PASSWORD) {
  throw new Error('Conecte o Neon (DATABASE_URL) e configure ADMIN_PASSWORD antes do deploy.');
}
const sql = neon(process.env.DATABASE_URL);
await sql`CREATE TABLE IF NOT EXISTS campo_registros (
  id uuid PRIMARY KEY, dados jsonb NOT NULL, fachada bytea, medidor bytea
)`;
await sql`CREATE TABLE IF NOT EXISTS campo_equipe (
  usuario text PRIMARY KEY, nome text NOT NULL, salt text NOT NULL, senha_hash text NOT NULL
)`;
await sql`CREATE TABLE IF NOT EXISTS campo_sessoes (
  token_hash text PRIMARY KEY, usuario text NOT NULL REFERENCES campo_equipe(usuario),
  validade timestamptz NOT NULL
)`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS campo_registros_local_unico
  ON campo_registros ((dados->>'local_id')) WHERE dados->>'local_id' IS NOT NULL`;
const {copyFile,mkdir}=await import('node:fs/promises');
await mkdir('public/vendor',{recursive:true});
for(const extension of ['js','css']){
  await copyFile('node_modules/maplibre-gl/dist/maplibre-gl.'+extension,'public/vendor/maplibre-gl.'+extension);
}
await sql`CREATE TABLE IF NOT EXISTS campo_fotos (
 id uuid PRIMARY KEY, registro uuid NOT NULL, usuario text NOT NULL REFERENCES campo_equipe(usuario),
 ext text NOT NULL, imagem bytea NOT NULL, miniatura bytea, criada timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE INDEX IF NOT EXISTS campo_fotos_registro ON campo_fotos(registro, usuario)`;

// Recupera espaço de envios interrompidos sem tocar nas fotos de fichas salvas.
await sql`DELETE FROM campo_fotos f WHERE criada < now()-interval '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM campo_registros r WHERE r.id=f.registro AND (
      coalesce(r.dados->'fotosFachada','[]'::jsonb) ? f.id::text OR
      coalesce(r.dados->'fotosFonte','[]'::jsonb) ? f.id::text OR
      EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(r.dados->'hds','[]'::jsonb)) hd WHERE (hd->'fotos') ? f.id::text)
    )
  )`;
