// Copy to the clipboard so it pastes as a real table in Outlook / Word / Sheets, with plain text as the fallback.
// Order: a hidden formatted copy selected and copied (keeps the table for Outlook), the clipboard with HTML, plain text.
// One copy of this for the Camp Audit email and the Camp Data lists.
export async function copyRich(html, text) {
  if (html) {
    const box = document.createElement('div');
    box.setAttribute('contenteditable', 'true');
    box.style.cssText = 'position:fixed;left:-10000px;top:0;width:600px;opacity:0;background:#fff;color:#000';
    box.innerHTML = html; document.body.appendChild(box);
    const sel = window.getSelection(); const rg = document.createRange(); rg.selectNodeContents(box); sel.removeAllRanges(); sel.addRange(rg);
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    sel.removeAllRanges(); box.remove();
    if (ok) return true;
    try { await navigator.clipboard.write([new window.ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]); return true; } catch (e) { /* next */ }
  }
  if (!html) {   // plain text (one link): a hidden text box selected and copied works where the clipboard API is blocked
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    if (ok) return true;
  }
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
}
