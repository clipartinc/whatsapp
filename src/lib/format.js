export function codeInline(s) {
    return `\`${String(s)}\``
  }
  
  export function bold(s) {
    return `**${String(s)}**`
  }
  
  export function bullets(lines) {
    return lines.map(l => `• ${l}`).join('\n')
  }
  