import { RHYTHM_BEATS } from '../music/rhythmDetector';
import { midiName } from '../music/noteUtils';
import type { PracticeSession, Spelling } from '../music/types';

export interface SessionExporter { extension: string; mime: string; serialize(session: PracticeSession, spelling: Spelling): string | Uint8Array; }
export const jsonExporter: SessionExporter = { extension: 'json', mime: 'application/json', serialize: session => JSON.stringify(session, null, 2) };
const PPQ = 480;
function variableLength(value: number): number[] {
  const result = [value & 127];
  while ((value = Math.floor(value / 128)) > 0) result.unshift((value & 127) | 128);
  return result;
}
function bigEndian(value: number, length: number): number[] { return Array.from({ length }, (_, i) => (value >>> (8 * (length - i - 1))) & 255); }

export const midiExporter: SessionExporter = {
  extension: 'mid', mime: 'audio/midi', serialize(session) {
    // Constant session tempo; actual onset/duration timestamps preserve performed timing.
    const micros = Math.round(60_000_000 / session.bpm);
    const track = [0, 0xff, 0x51, 3, ...bigEndian(micros, 3), 0, 0xc0, 0];
    const events: { tick: number; bytes: number[]; priority: number }[] = [];
    const tick = (seconds: number) => Math.max(0, Math.round(seconds * session.bpm / 60 * PPQ));
    for (const note of session.notes) {
      events.push({ tick: tick(note.onset), bytes: [0x90, note.midi, 80], priority: 1 });
      events.push({ tick: Math.max(tick(note.onset) + 1, tick(note.onset + note.duration)), bytes: [0x80, note.midi, 0], priority: 0 });
    }
    events.sort((a, b) => a.tick - b.tick || a.priority - b.priority);
    let previous = 0;
    for (const event of events) { track.push(...variableLength(event.tick - previous), ...event.bytes); previous = event.tick; }
    track.push(0, 0xff, 0x2f, 0);
    return new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, ...bigEndian(PPQ, 2),
      0x4d, 0x54, 0x72, 0x6b, ...bigEndian(track.length, 4), ...track]);
  },
};

export const musicXmlExporter: SessionExporter = {
  extension: 'musicxml', mime: 'application/vnd.recordare.musicxml+xml', serialize(session, spelling) {
    const divisions = 2;
    const types = { w: 'whole', h: 'half', q: 'quarter', '8': 'eighth' };
    // Senza-misura transcription: approximate durations, chronological notes, no invented rests.
    const measures: string[] = [];
    for (let offset = 0; offset < session.notes.length || offset === 0; offset += 8) {
      const notes = session.notes.slice(offset, offset + 8).map(note => {
        const name = midiName(note.midi, spelling);
        const alter = name.includes('#') ? 1 : name.includes('b') ? -1 : 0;
        return `<note><pitch><step>${name[0]}</step><alter>${alter}</alter><octave>${note.octave}</octave></pitch><duration>${RHYTHM_BEATS[note.rhythm] * divisions}</duration><type>${types[note.rhythm]}</type>${alter ? `<accidental>${alter === 1 ? 'sharp' : 'flat'}</accidental>` : ''}<staff>${note.midi < 60 ? 2 : 1}</staff></note>`;
      }).join('\n');
      const attributes = offset === 0 ? `<attributes><divisions>${divisions}</divisions><time><senza-misura/></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes><direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${session.bpm}</per-minute></metronome></direction-type><sound tempo="${session.bpm}"/></direction>` : '';
      measures.push(`<measure number="${offset / 8 + 1}" implicit="yes">${attributes}\n${notes}</measure>`);
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n<score-partwise version="4.0"><work><work-title>Xon Music practice</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name><part-abbreviation>Pno.</part-abbreviation><score-instrument id="I1"><instrument-name>Piano</instrument-name></score-instrument><midi-instrument id="I1"><midi-channel>1</midi-channel><midi-program>1</midi-program></midi-instrument></score-part></part-list><part id="P1">${measures.join('\n')}</part></score-partwise>`;
  },
};

export function downloadSession(exporter: SessionExporter, session: PracticeSession, spelling: Spelling): void {
  const data = exporter.serialize(session, spelling);
  const blob = new Blob([typeof data === 'string' ? data : new Uint8Array(data).buffer], { type: exporter.mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url;
  link.download = `xon-practice-${session.startedAt.slice(0, 19).replace(/:/g, '-')}.${exporter.extension}`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
