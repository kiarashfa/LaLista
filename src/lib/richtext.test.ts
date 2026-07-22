import { describe, expect, it } from 'vitest';
import { isRichEmpty, sanitizeRichText, toEditableHtml } from './richtext';

describe('sanitizeRichText', () => {
  it('keeps the allowed formatting tags, bare', () => {
    expect(sanitizeRichText('<b>hola</b> <i>qué</i> <u>tal</u><br><div>línea</div>')).toBe(
      '<b>hola</b> <i>qué</i> <u>tal</u><br><div>línea</div>',
    );
  });

  it('strips attributes from allowed tags', () => {
    expect(sanitizeRichText('<b style="color:red" onclick="x()">hola</b>')).toBe('<b>hola</b>');
    expect(sanitizeRichText('<div class="x" data-y="<b>">text</div>')).toBe('<div>text</div>');
  });

  it('drops disallowed tags but keeps their text', () => {
    expect(sanitizeRichText('<script>alert(1)</script>')).toBe('alert(1)');
    expect(sanitizeRichText('<a href="https://evil">link</a>')).toBe('link');
    expect(sanitizeRichText('<img src=x onerror=alert(1)>')).toBe('');
    expect(sanitizeRichText('<span style="font-weight:bold">x</span>')).toBe('x');
  });

  it('neutralizes markup that survives tag removal', () => {
    // nested-tag trick: removing the outer shell must not leave a working tag
    const out = sanitizeRichText('<scr<b>ipt>alert(1)</scr</b>ipt>');
    expect(out).not.toContain('<script');
    // stray, never-closed '<' becomes a harmless entity
    expect(sanitizeRichText('2 < 3 pero <b>4</b>')).toBe('2 &lt; 3 pero <b>4</b>');
  });

  it('removes HTML comments', () => {
    expect(sanitizeRichText('a<!-- <script>x</script> -->b')).toBe('ab');
  });
});

describe('toEditableHtml', () => {
  it('escapes legacy plain-text notes and converts newlines', () => {
    expect(toEditableHtml('uno\ndos & <tres>')).toBe('uno<br>dos &amp; &lt;tres&gt;');
  });

  it('passes already-rich values through the sanitizer', () => {
    expect(toEditableHtml('<b onclick="x">hola</b>')).toBe('<b>hola</b>');
  });

  it('handles empty input', () => {
    expect(toEditableHtml('')).toBe('');
  });
});

describe('isRichEmpty', () => {
  it('treats tag-only or whitespace HTML as empty', () => {
    expect(isRichEmpty('')).toBe(true);
    expect(isRichEmpty('<br>')).toBe(true);
    expect(isRichEmpty('<div><br></div>')).toBe(true);
    expect(isRichEmpty('&nbsp; ')).toBe(true);
    expect(isRichEmpty('<b>x</b>')).toBe(false);
  });
});
