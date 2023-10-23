import React, { useEffect, useRef, FC } from 'react';

interface SoundWaveCanvasProps {
  mediaStream: MediaStream | null;
}

const SoundWaveCanvas: FC<SoundWaveCanvasProps> = ({ mediaStream }) => {
  const pluseRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pluseRef.current || !mediaStream) return console.error("Sound Wave Canvas or MediaStream not found.");
    if (!mediaStream.getAudioTracks().length) return;


    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();

    const audioSource = audioContext.createMediaStreamSource(mediaStream);
    audioSource.connect(analyser);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updatePulse = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const scaleFactor = average / 100;
      if(!pluseRef.current) return;
      pluseRef.current.style.transform = `scale(${1 + scaleFactor})`;
      requestAnimationFrame(updatePulse);
    }

    audioContext.resume().then(() => {
      updatePulse();
    });

    return () => {
      audioContext.close();
    };
  }, [mediaStream]);

  return <div className="absolute w-32 h-32 bg-gray-500 rounded-full opacity-75" ref={pluseRef}></div>;
};

export default SoundWaveCanvas;
