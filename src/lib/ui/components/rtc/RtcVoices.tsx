import { useEffect, useMemo, useRef } from 'react';

import {
  RtcParticipant,
  useApp,
} from '@/lib/hooks';


////////////////////////////////////////////////////////////
type RtcVoiceProps = {
  participant: RtcParticipant;
};

////////////////////////////////////////////////////////////
function RtcVoice({ participant }: RtcVoiceProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Setting audio stream
  useEffect(() => {
    if (!participant.audio || !audioRef.current) return;

    // Set audio element source
    const mstream = new MediaStream([participant.audio.track]);
    audioRef.current.srcObject = mstream;
    audioRef.current.play();
  }, [participant.audio, audioRef.current]);

  // Setting audio volume
  useEffect(() => {
    if (!audioRef.current || isNaN(participant.volume)) return;

    // Set audio element volume
    audioRef.current.volume = participant.volume * 0.01;
  }, [participant.volume, audioRef.current]);

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      muted={false}
      controls={false}
    />
  );
}


////////////////////////////////////////////////////////////
export default function RtcVoices() {
  const app = useApp();

  // Get a list of participants with a voice element
  const participants = useMemo<RtcParticipant[]>(() => {
    return Object.values(app.rtc?.participants || {}).filter(x => x.audio !== undefined);
  }, [app.rtc?.participants]);

  return (
    <>
      {participants.map((participant, i) => (
        <RtcVoice key={participant.id} participant={participant} />
      ))}
    </>
  );
}
