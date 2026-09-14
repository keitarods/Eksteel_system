export const LIMITE_IMAGEM = 3 * 1024 * 1024;
export function validarLink(valor: unknown) {
  if (typeof valor !== 'string' || valor.length > 2048) throw new Error('Link inválido.');
  if (!valor.trim()) return null;
  let url: URL;
  try { url = new URL(valor.trim()); } catch { throw new Error('Informe um link completo do Mercado Livre.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !(host === 'mercadolivre.com.br' || host.endsWith('.mercadolivre.com.br') || host === 'mercadolibre.com' || host.endsWith('.mercadolibre.com') || host === 'meli.la')) throw new Error('Use um link HTTPS do Mercado Livre ou meli.la.');
  return url.href;
}
export function validarDados(body: unknown) {
  if (!body || typeof body !== 'object') throw new Error('Dados inválidos.');
  const b = body as Record<string, unknown>;
  if (typeof b.descricao !== 'string' || b.descricao.length > 10000) throw new Error('A descrição deve ter até 10.000 caracteres.');
  if (typeof b.ordem !== 'number' || !Number.isInteger(b.ordem) || b.ordem < 0 || b.ordem > 1000000) throw new Error('A ordem deve ser um inteiro entre 0 e 1.000.000.');
  return { descricao: b.descricao.trim() || null, ordem: b.ordem, link_mercado_livre: validarLink(b.link_mercado_livre), link_mercado_livre_2: validarLink(b.link_mercado_livre_2) };
}
export function padraoImagem(base: string) {
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}(?:_(\\d+))?\\.(jpe?g|png|webp)$`, 'i');
}
export function tipoImagem(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return { ext: 'png', mime: 'image/png' };
  if (String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  throw new Error('Envie uma imagem JPEG, PNG ou WebP válida.');
}

export const LIMITE_MODELO = 3 * 1024 * 1024;
export function validarGlb(bytes: Uint8Array) {
  if (bytes.length < 20 || bytes.length > LIMITE_MODELO) throw new Error('Envie um modelo GLB de até 3 MB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length) throw new Error('Arquivo GLB inválido. Exporte no formato GLB 2.0.');
  const tamanho = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || tamanho % 4 !== 0 || tamanho > bytes.length - 20) throw new Error('Estrutura GLB inválida.');
  let json;
  try { json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + tamanho))); } catch { throw new Error('Conteúdo GLB inválido.'); }
  if (json?.asset?.version !== '2.0') throw new Error('Exporte o modelo no formato GLB 2.0.');
  let offset = 20 + tamanho;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error('Arquivo GLB incompleto.');
    const length = view.getUint32(offset, true);
    if (length % 4 !== 0 || length > bytes.length - offset - 8) throw new Error('Arquivo GLB incompleto.');
    offset += 8 + length;
  }
}
