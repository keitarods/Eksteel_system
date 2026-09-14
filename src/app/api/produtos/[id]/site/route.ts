import { createClient as createAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { LIMITE_IMAGEM, LIMITE_MODELO, validarGlb, padraoImagem, tipoImagem, validarDados } from '@/lib/portfolio/validacao';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
class Falha extends Error { constructor(message: string, public status = 400) { super(message); } }
const responderErro = (e: unknown) => Response.json({ error: e instanceof Falha ? e.message : 'Não foi possível concluir. Tente novamente.' }, { status: e instanceof Falha ? e.status : 500 });
async function autorizar(req: Request, context: Context) {
  if (req.method !== 'GET' && req.headers.get('origin') !== new URL(req.url).origin) throw new Falha('Origem não autorizada.', 403);
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Falha('Produto inválido.');
  const userClient = await createClient();
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) throw new Falha('Faça login novamente.', 401);
  const { data: membro, error: memberError } = await userClient.from('usuarios_empresa').select('papel').eq('usuario_id', user.id).maybeSingle();
  if (memberError || !membro || !['admin','socio'].includes(membro.papel)) throw new Falha('Seu usuário não pode editar o portfólio.', 403);
  const { data: produto, error: productError } = await userClient.from('produtos').select('id').eq('id', id).maybeSingle();
  if (productError || !produto) throw new Falha('Produto não encontrado ou sem acesso.', 404);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) throw new Falha('Configure a chave de serviço do Supabase no servidor.', 503);
  const admin = createAdmin(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: site, error } = await admin.from('produtos_site').select('id,nome,categoria,descricao,ordem,ativo,arquivo_base,link_mercado_livre,link_mercado_livre_2').eq('produto_id', id).maybeSingle();
  if (error) throw new Falha('Não foi possível ler o catálogo. Verifique a configuração inicial da integração.', 503);
  if (!site) throw new Falha('Este produto ainda não está vinculado ao site. Vincule o cadastro existente ou salve a publicação no cadastro principal.', 409);
  return { admin, site };
}
async function imagens(admin: Awaited<ReturnType<typeof autorizar>>['admin'], base: string) {
  const lista: { nome: string; url: string }[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from('produtos-imagens').list('', { limit: 100, offset, search: base, sortBy: { column: 'name', order: 'asc' } });
    if (error || !data) throw new Falha('Não foi possível carregar as imagens do Storage.', 502);
    for (const item of data) if (padraoImagem(base).test(item.name)) lista.push({ nome: item.name, url: admin.storage.from('produtos-imagens').getPublicUrl(item.name).data.publicUrl });
    if (data.length < 100) break;
  }
  return lista.sort((a,b) => Number(padraoImagem(base).exec(a.nome)?.[1] ?? -1) - Number(padraoImagem(base).exec(b.nome)?.[1] ?? -1));
}
async function verificarBase(admin: Awaited<ReturnType<typeof autorizar>>['admin'], base: string) {
  if (!base || base.length > 180 || /[/\\\u0000-\u001f]/.test(base)) throw new Falha('Nome-base de imagens incompatível. Revise o cadastro do site.', 409);
  const { count, error } = await admin.from('produtos_site').select('id', { count: 'exact', head: true }).eq('arquivo_base', base);
  if (error || count !== 1) throw new Falha('O nome-base não é exclusivo deste produto. Revise o vínculo antes de alterar imagens.', 409);
}
async function modelo(admin: Awaited<ReturnType<typeof autorizar>>['admin'], base: string) {
  const nome = `${base}.glb`;
  const { data, error } = await admin.storage.from('produtos-modelos-3d').list('', { search: nome, limit: 100 });
  if (error) throw new Falha('Não foi possível consultar o modelo 3D no Storage.', 502);
  const arquivo = data?.find(item => item.name.toLowerCase() === nome.toLowerCase());
  return arquivo ? { nome: arquivo.name, url: admin.storage.from('produtos-modelos-3d').getPublicUrl(arquivo.name).data.publicUrl } : null;
}
export async function GET(req: Request, context: Context) {
  try { const { admin, site } = await autorizar(req, context); return Response.json({ produto: site, imagens: await imagens(admin, site.arquivo_base), modelo: await modelo(admin, site.arquivo_base) }, { headers: { 'Cache-Control': 'private, no-store' } }); } catch(e) { return responderErro(e); }
}
export async function PATCH(req: Request, context: Context) {
  try {
    const { admin, site } = await autorizar(req, context);
    if (Number(req.headers.get('content-length')) > 50000) throw new Falha('Dados muito grandes.', 413);
    let payload;
    try { payload = validarDados(await req.json()); } catch(e) { throw new Falha(e instanceof Error ? e.message : 'Dados inválidos.'); }
    const { error, data } = await admin.from('produtos_site').update(payload).eq('id', site.id).select('id').single();
    if (error || !data) throw new Falha('Não foi possível salvar os dados do site.', 502);
    return Response.json({ ok: true });
  } catch(e) { return responderErro(e); }
}
export async function POST(req: Request, context: Context) {
  try {
    const { admin, site } = await autorizar(req, context);
    await verificarBase(admin, site.arquivo_base);
    if (Number(req.headers.get('content-length')) > LIMITE_IMAGEM + 65536) throw new Falha('Cada imagem pode ter até 3 MB.', 413);
    const form = await req.formData();
    const glb = form.get('modelo');
    if (glb !== null) {
      if (!(glb instanceof File) || !/\.glb$/i.test(glb.name) || !glb.size || glb.size > LIMITE_MODELO) throw new Falha('Selecione um arquivo .glb de até 3 MB.');
      const bytes = new Uint8Array(await glb.arrayBuffer());
      try { validarGlb(bytes); } catch(e) { throw new Falha((e as Error).message); }
      const existente = await modelo(admin, site.arquivo_base);
      const nome = existente?.nome ?? `${site.arquivo_base}.glb`;
      const { error } = await admin.storage.from('produtos-modelos-3d').upload(nome, bytes, { contentType: 'model/gltf-binary', upsert: true, cacheControl: '60' });
      if (error) throw new Falha('Não foi possível enviar o modelo. Verifique se o bucket produtos-modelos-3d permite arquivos GLB.', 502);
      return Response.json({ ok: true });
    }
    const file = form.get('imagem');
    if (!(file instanceof File) || !file.size || file.size > LIMITE_IMAGEM) throw new Falha('Selecione uma imagem de até 3 MB.', 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let tipo;
    try { tipo = tipoImagem(bytes); } catch(e) { throw new Falha((e as Error).message); }
    const nome = `${site.arquivo_base}_${Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000}.${tipo.ext}`;
    const { error } = await admin.storage.from('produtos-imagens').upload(nome, bytes, { contentType: tipo.mime, upsert: false });
    if (error) throw new Falha('Não foi possível enviar a imagem. Tente novamente.', 502);
    return Response.json({ ok: true });
  } catch(e) { return responderErro(e); }
}
export async function DELETE(req: Request, context: Context) {
  try {
    const { admin, site } = await autorizar(req, context);
    await verificarBase(admin, site.arquivo_base);
    const body = await req.json().catch(() => null);
    if (typeof body?.nome !== 'string' || !padraoImagem(site.arquivo_base).test(body.nome)) throw new Falha('Imagem não pertence a este produto.');
    const { error } = await admin.storage.from('produtos-imagens').remove([body.nome]);
    if (error) throw new Falha('Não foi possível remover a imagem.', 502);
    return Response.json({ ok: true });
  } catch(e) { return responderErro(e); }
}
