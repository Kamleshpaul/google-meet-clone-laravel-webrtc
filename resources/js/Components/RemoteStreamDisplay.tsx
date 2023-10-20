import React, { useEffect, useRef, useState } from 'react';
import SoundWaveCanvas from './SoundWaveCanvas';
import { Avatar } from '@chakra-ui/react';

interface RemoteStreamDisplayProps {
    remoteStream: MediaStream | undefined;
    name: string;
}

const RemoteStreamDisplay: React.FC<RemoteStreamDisplayProps> = ({
    remoteStream,
    name,
}) => {
    const [videoEnabled, setVideoEnabled] = useState(false)
    const [audioEnabled, setAudioEnabled] = useState(false)



    useEffect(() => {
        if (remoteStream) {
            setVideoEnabled(remoteStream.getVideoTracks().length > 0);
            setAudioEnabled(remoteStream.getAudioTracks().length > 0);

            remoteStream.onremovetrack = () => {
                setVideoEnabled(false);
                setAudioEnabled(false);
            }
        } else {
            setVideoEnabled(false);
            setAudioEnabled(false);
        }
    }, [remoteStream]);

    return (
        <div>
            <div
                className={`flex items-center justify-center bg-gray-400 ${!videoEnabled ? '' : 'hidden'
                    }`}
                style={{ width: '30rem', height: '18rem' }}
            >
                <Avatar name={name} size='2xl' />
                {(audioEnabled && remoteStream) && (
                    <SoundWaveCanvas mediaStream={remoteStream} />
                )}
            </div>

            <video
                autoPlay
                playsInline
                className={`w-full h-full rounded ${videoEnabled && remoteStream ? '' : 'hidden'}`}
                ref={(videoRef) => {
                    if (videoRef && remoteStream) {
                        (videoRef as HTMLVideoElement).srcObject = remoteStream;
                    }
                }}
            ></video>
        </div>
    );
};

export default RemoteStreamDisplay;
