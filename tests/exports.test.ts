import { describe, expect, it } from 'vitest';
import { jsonExporter, midiExporter, musicXmlExporter } from '../src/session/exports';
import { mapFrequency } from '../src/music/noteUtils';
import type { PracticeSession } from '../src/music/types';

const session: PracticeSession = { version: 1, id: 'test', startedAt: '2026-10-01T10:00:00.000Z', bpm: 120, elapsed: 4,
  notes: [{ ...mapFrequency(277.1826), id: 'one', onset: .2, duration: .5, confidence: .98, rhythm: 'q', bpm: 120, ended: true },
    { ...mapFrequency(110), id: 'two', onset: 1, duration: 1, confidence: .95, rhythm: 'h', bpm: 120, ended: true }] };
describe('portable session exports', () => {
  it('keeps all measured fields in JSON', () => expect(JSON.parse(jsonExporter.serialize(session, 'sharps') as string)).toEqual(session));
  it('writes a type 0 MIDI file with valid chunk lengths and timed note events', () => {
    const bytes = midiExporter.serialize(session, 'sharps') as Uint8Array;
    const view = new DataView(bytes.buffer);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('MThd');
    expect(view.getUint32(4)).toBe(6); expect(view.getUint16(10)).toBe(1); expect(view.getUint16(12)).toBe(480);
    expect(new TextDecoder().decode(bytes.slice(14, 18))).toBe('MTrk');
    expect(view.getUint32(18)).toBe(bytes.length - 22);
    // Decode variable-length deltas to establish actual MIDI timing rather than matching bytes only.
    let position = 22, tick = 0; const events: number[][] = [];
    while (position < bytes.length) {
      let delta = 0, byte: number;
      do { byte = bytes[position++]; delta = delta * 128 + (byte & 127); } while (byte & 128);
      tick += delta; const status = bytes[position++];
      if (status === 0xff) { position++; const length = bytes[position++]; position += length; }
      else if (status === 0xc0) position++;
      else { events.push([tick, status, bytes[position++], bytes[position++]]); }
    }
    expect(events).toEqual([[192, 0x90, 61, 80], [672, 0x80, 61, 0], [960, 0x90, 45, 80], [1920, 0x80, 45, 0]]);
  });
  it('exports grand staff, enharmonic spelling and approximate rhythms in MusicXML', () => {
    const xml = musicXmlExporter.serialize(session, 'flats') as string;
    expect(xml).toContain('<step>D</step><alter>-1</alter><octave>4</octave>');
    expect(xml).toContain('<accidental>flat</accidental>'); expect(xml).toContain('<staff>2</staff>');
    expect(xml).toContain('<senza-misura/>'); expect(xml).toContain('<type>half</type>');
  });
});
