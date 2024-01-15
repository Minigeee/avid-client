import { useEffect, useMemo, useRef } from 'react';

import { useRtc } from '@/lib/hooks';
import { RtcParticipant } from '@/lib/contexts';

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
    audioRef.current
      .play()
      .then(() => console.log('autoplay success'))
      .catch((err) => console.error('failed to autoplay audio', err));
  }, [participant.audio, audioRef.current]);

  // Setting audio volume
  useEffect(() => {
    if (!audioRef.current || isNaN(participant.volume)) return;

    // Set audio element volume
    audioRef.current.volume = participant.volume * 0.01;
  }, [participant.volume, audioRef.current]);

  return (
    <audio ref={audioRef} autoPlay playsInline muted={false} controls={false} />
  );
}

////////////////////////////////////////////////////////////
export default function RtcVoices() {
  const rtc = useRtc();

  // Get a list of participants with a voice element
  const participants = useMemo<RtcParticipant[]>(() => {
    return Object.values(rtc.participants || {}).filter(
      (x) => x.audio !== undefined,
    );
  }, [rtc.participants]);

  return (
    <>
      {participants.map((participant, i) => (
        <RtcVoice key={participant.id} participant={participant} />
      ))}
    </>
  );
}
