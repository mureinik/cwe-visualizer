// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseNuance } from '../../scripts/nuance.ts';

describe('parseNuance', () => {
  it('names the element it converts in an error', () => {
    expect(() => parseNuance('<xhtml:table/>', '191', 'Alternate_Term Description'))
      .toThrow('CWE-191: unsupported <xhtml:table> in Alternate_Term Description');
  });

  it('keeps plain text as one paragraph', () => {
    const input = '\n\t   For example, a "." in SMTP signifies the end of mail message data, whereas a null character can be used for the end of a string.\n\t ';
    expect(parseNuance(input, '147')).toEqual([
      {
        kind: 'paragraph',
        lines: [[{ text: 'For example, a "." in SMTP signifies the end of mail message data, whereas a null character can be used for the end of a string.' }]],
      },
    ]);
  });

  it('turns paragraphs and lists into blocks, in order', () => {
    const input = `
            <xhtml:p>Targeted technologies include, but are not necessarily limited to:</xhtml:p>
            <xhtml:ul>
               <xhtml:li>automated speech recognition</xhtml:li>
               <xhtml:li>automated image recognition</xhtml:li>
            </xhtml:ul>
         `;
    expect(parseNuance(input, '1039')).toEqual([
      { kind: 'paragraph', lines: [[{ text: 'Targeted technologies include, but are not necessarily limited to:' }]] },
      { kind: 'list', items: [[[{ text: 'automated speech recognition' }]], [[{ text: 'automated image recognition' }]]] },
    ]);
  });

  it('keeps bare text before a paragraph first', () => {
    const input = `
      For example, an unexpected physical or environmental condition may cause the flipping of a bit that is used for an authentication decision.
      <xhtml:p>Physical or environmental conditions of concern are:</xhtml:p>
      <xhtml:ul>
        <xhtml:li>
          <xhtml:div><xhtml:b>Interference: </xhtml:b>electromagnetic interference (EMI), etc.</xhtml:div>
        </xhtml:li>
      </xhtml:ul>
    `;
    expect(parseNuance(input, '1384')).toEqual([
      {
        kind: 'paragraph',
        lines: [[{ text: 'For example, an unexpected physical or environmental condition may cause the flipping of a bit that is used for an authentication decision.' }]],
      },
      { kind: 'paragraph', lines: [[{ text: 'Physical or environmental conditions of concern are:' }]] },
      {
        kind: 'list',
        items: [[[{ text: 'Interference: ', bold: true }, { text: 'electromagnetic interference (EMI), etc.' }]]],
      },
    ]);
  });

  it('makes each p inside a list item a line of it', () => {
    const input = `
\t <xhtml:ul>
\t   <xhtml:li>
\t <xhtml:p><xhtml:b>Reflected XSS exploits (Type 1)</xhtml:b> occur when an attacker causes a victim to supply dangerous content.</xhtml:p>
\t <xhtml:p><xhtml:b>Stored XSS (Type 2)</xhtml:b> is stored.</xhtml:p>
\t   </xhtml:li>
\t </xhtml:ul>
\t `;
    expect(parseNuance(input, '79')).toEqual([
      {
        kind: 'list',
        items: [[
          [{ text: 'Reflected XSS exploits (Type 1)', bold: true }, { text: ' occur when an attacker causes a victim to supply dangerous content.' }],
          [{ text: 'Stored XSS (Type 2)', bold: true }, { text: ' is stored.' }],
        ]],
      },
    ]);
  });

  it('gives each div of an indented block its own line, without a list', () => {
    const input = `
            <xhtml:p>There are two main variations of a hard-coded password:</xhtml:p>
            <xhtml:div style="margin-left:1em;">
               <xhtml:div>Inbound: the product contains an authentication mechanism that checks for a hard-coded password.</xhtml:div>
               <xhtml:div>Outbound: the product connects to another system or component, and it contains a hard-coded password for connecting to that component.</xhtml:div>
            </xhtml:div>
         `;
    expect(parseNuance(input, '259')).toEqual([
      { kind: 'paragraph', lines: [[{ text: 'There are two main variations of a hard-coded password:' }]] },
      {
        kind: 'paragraph',
        lines: [
          [{ text: 'Inbound: the product contains an authentication mechanism that checks for a hard-coded password.' }],
          [{ text: 'Outbound: the product connects to another system or component, and it contains a hard-coded password for connecting to that component.' }],
        ],
      },
    ]);
  });

  it('treats the source\'s line breaks as spaces', () => {
    const input = `
\t   <xhtml:p>
\t     Documentation elements might include the product's usage,
\t     structure, architectural components, interfaces, design,
\t     implementation, configuration, operation, etc.
\t   </xhtml:p>
\t `;
    expect(parseNuance(input, '1059')).toEqual([
      {
        kind: 'paragraph',
        lines: [[{ text: 'Documentation elements might include the product\'s usage, structure, architectural components, interfaces, design, implementation, configuration, operation, etc.' }]],
      },
    ]);
  });

  it('keeps text that looks like a number as a string', () => {
    expect(parseNuance('<xhtml:ul><xhtml:li>2026</xhtml:li></xhtml:ul>', '1')).toEqual([
      { kind: 'list', items: [[[{ text: '2026' }]]] },
    ]);
  });

  it('keeps exactly one space across a bold boundary', () => {
    expect(parseNuance('<xhtml:p>see  <xhtml:b> this </xhtml:b>  note</xhtml:p>', '1')).toEqual([
      { kind: 'paragraph', lines: [[{ text: 'see ' }, { text: 'this ', bold: true }, { text: 'note' }]] },
    ]);
    expect(parseNuance('<xhtml:p><xhtml:b>A:</xhtml:b>b</xhtml:p>', '1')).toEqual([
      { kind: 'paragraph', lines: [[{ text: 'A:', bold: true }, { text: 'b' }]] },
    ]);
  });

  it('decodes entities as text', () => {
    expect(parseNuance('<xhtml:p>a &amp; b &lt;c&gt;</xhtml:p>', '1')).toEqual([
      { kind: 'paragraph', lines: [[{ text: 'a & b <c>' }]] },
    ]);
  });

  // Real-world: MITRE's serializer writes non-ASCII as numeric character
  // references elsewhere in this file (e.g. <Author>Adam Doup&#233;</Author>),
  // which is outside our control.
  it('decodes numeric character references once', () => {
    expect(parseNuance('<xhtml:p>caf&#233; &#x2014; &amp;lt;</xhtml:p>', '1')).toEqual([
      { kind: 'paragraph', lines: [[{ text: 'café — &lt;' }]] },
    ]);
  });

  // Real-world: the design collapses spaces, tabs and newlines only.
  it('keeps a non-breaking space inside a line', () => {
    expect(parseNuance('<xhtml:p>a&#160;b</xhtml:p>', '1')).toEqual([
      { kind: 'paragraph', lines: [[{ text: 'a\u00a0b' }]] },
    ]);
  });

  // Real-world: empty markup is allowed by the schema and shows nothing.
  it('drops empty lists, items and bold runs', () => {
    expect(parseNuance('<xhtml:ul><xhtml:li> </xhtml:li></xhtml:ul>', '1')).toEqual([]);
    expect(parseNuance('<xhtml:ul/>', '1')).toEqual([]);
    expect(parseNuance('<xhtml:p><xhtml:b></xhtml:b>x</xhtml:p>', '1')).toEqual([
      { kind: 'paragraph', lines: [[{ text: 'x' }]] },
    ]);
  });

  it('drops empty elements', () => {
    expect(parseNuance('<xhtml:p/><xhtml:p>  </xhtml:p>', '1')).toEqual([]);
    expect(parseNuance('', '1')).toEqual([]);
  });

  describe('fails on markup it does not know', () => {
    // Real-world: the schema allows any XHTML here, so unknown markup would
    // be a MITRE format change, not a mistake.
    it.each([
      ['an unknown inline element', '<xhtml:p>a<xhtml:br/>b</xhtml:p>', 'unsupported <xhtml:br> in Technical_Nuance > p'],
      ['an unknown block element', '<xhtml:ol><xhtml:li>x</xhtml:li></xhtml:ol>', 'unsupported <xhtml:ol> in Technical_Nuance'],
      ['a known tag out of place', '<xhtml:p><xhtml:ul><xhtml:li>x</xhtml:li></xhtml:ul></xhtml:p>', 'unsupported <xhtml:ul> in Technical_Nuance > p'],
      ['a top-level b', '<xhtml:b>x</xhtml:b>', 'unsupported <xhtml:b> in Technical_Nuance'],
      ['text in a top-level div', '<xhtml:div>x</xhtml:div>', 'unexpected text in Technical_Nuance > div'],
      ['text in a ul', '<xhtml:ul>x</xhtml:ul>', 'unexpected text in Technical_Nuance > ul'],
      ['an attribute on a p', '<xhtml:p class="x">y</xhtml:p>', 'unsupported attribute class on <xhtml:p> in Technical_Nuance'],
      [
        'style on a div inside a top-level div',
        '<xhtml:div><xhtml:div style="margin-left:1em;">x</xhtml:div></xhtml:div>',
        'unsupported attribute style on <xhtml:div> in Technical_Nuance > div',
      ],
      [
        'style on a div inside an li',
        '<xhtml:ul><xhtml:li><xhtml:div style="margin-left:1em;">x</xhtml:div></xhtml:li></xhtml:ul>',
        'unsupported attribute style on <xhtml:div> in Technical_Nuance > ul > li',
      ],
    ])('%s', (_name, input, message) => {
      expect(() => parseNuance(input, '123')).toThrow(`CWE-123: ${message}`);
    });

    // Theoretical: the schema forbids elements outside the XHTML namespace in
    // StructuredTextType, so MITRE's data can't contain one.
    describe('an element outside the XHTML namespace', { tags: ['theoretical'] }, () => {
      it('fails on an element outside the XHTML namespace', () => {
        expect(() => parseNuance('<Note>x</Note>', '123')).toThrow('CWE-123: unsupported <Note> in Technical_Nuance');
      });
    });
  });
});
