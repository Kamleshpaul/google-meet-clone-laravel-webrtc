import React, { useEffect, useRef, FC } from 'react';

interface SoundWaveCanvasProps {
  mediaStream: MediaStream | null;
}

const SoundWaveCanvas: FC<SoundWaveCanvasProps> = ({ mediaStream }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mediaStream?.getAudioTracks().length) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();

    const audioSource = audioContext.createMediaStreamSource(mediaStream);
    audioSource.connect(analyser);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvasCtx = canvas.getContext('2d');
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const draw = () => {
      analyser.getByteTimeDomainData(dataArray);
      if(!canvasCtx) return;

      canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      canvasCtx.beginPath();

      const sliceAngle = (Math.PI * 2) / bufferLength;
      let angle = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const radius = (canvasHeight / 2) * v;
        const x = canvasWidth / 2 + radius * Math.cos(angle);
        const y = canvasHeight / 2 + radius * Math.sin(angle);

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        angle += sliceAngle;
      }

      canvasCtx.closePath();
      canvasCtx.stroke();

      requestAnimationFrame(draw);
    };

    draw();

    return () => {
      audioContext.close();
    };
  }, [mediaStream]);

  return <canvas className="absolute" ref={canvasRef} />;
};

export default SoundWaveCanvas;
