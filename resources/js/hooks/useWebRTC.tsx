import axios from 'axios';
import { useEffect, useRef, useState } from 'react';


const servers = {
    iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] },
    ],
};



export interface WebRTCState {
    isAudioMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing: boolean;
    setIsScreenSharing: React.Dispatch<React.SetStateAction<boolean>>;
    createOffer: (targetId: number, stream?: MediaStream) => void;
    removePeer: (targetId: number) => void;
    createPeer: (targetId: number, stream?: MediaStream) => Promise<RTCPeerConnection>;
    createMyVideoStream: (video: boolean, audio: boolean) => Promise<MediaStream>
    destroyConnection: () => Promise<void>;
    localStream: MediaStream;
    remoteStreams: Record<number, MediaStream>;
    isToggling: string | null
    toggleMic: () => void;
    toggleVideo: () => void;
}

export function useWebRTC({ meetingCode, userId }: { meetingCode: string, userId: number }): WebRTCState {
    const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
    const [isVideoOff, setIsVideoOff] = useState<boolean>(true);
    const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
    const [isToggling, setIsToggling] = useState<string | null>(null);

    const peersRef = useRef<Record<number, RTCPeerConnection>>([]);
    const renegotiatingRef = useRef(false);

    const [localStream, setLocalStream] = useState<MediaStream>(new MediaStream());
    const [remoteStreams, setRemoteStreams] = useState<Record<number, MediaStream>>({});

    const createStream = async ({ audio, video }: { audio: boolean, video: boolean }) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
            return stream;
        } catch (error) {
            return new MediaStream();
        }
    }

    const createMyVideoStream = async (video: boolean, audio: boolean) => {

        try {
            const stream = await createStream({ video, audio });
            setIsAudioMuted(!stream.getAudioTracks()[0]?.enabled);
            setIsVideoOff(!stream.getVideoTracks()[0]?.enabled);
            setLocalStream(stream);

            return stream;

        } catch (error) {
            const emptyStream = new MediaStream();
            setIsAudioMuted(true);
            setIsVideoOff(true);
            setLocalStream(emptyStream);
            console.error('Error  accessing camera and microphone :', error);
            return emptyStream;
        }
    };

    const destroyConnection = async () => {
        localStream?.getTracks().forEach(track => track.stop());

        Object.values(remoteStreams).forEach((stream) => {
            stream.getTracks().forEach(track => track.stop());
        });

        const cleanupPromises = Object.keys(peersRef.current).map(async (targetId) => {
            return new Promise<void>((resolve) => {
                const peer = peersRef.current[parseInt(targetId)];
                if (peer) {
                    peer.ontrack = null;
                    peer.onicecandidate = null;
                    peer.onsignalingstatechange = null;
                    peer.onconnectionstatechange = null;

                    peer.close();
                    delete peersRef.current[parseInt(targetId)];
                    console.log("DESTROY " + targetId);
                    resolve();
                }
            });
        });

        await Promise.all(cleanupPromises);
        peersRef.current = [];
        console.log("All connections destroyed");
    }


    const createPeer = async (targetId: number, stream?: MediaStream): Promise<RTCPeerConnection> => {
        const peer = new RTCPeerConnection(servers);

        if (stream) {
            stream.getTracks().forEach(track => {
                peer.addTrack(track, stream);
            })

        }

        peer.onicecandidate = (event) => {
            if (!event?.candidate) return;
            if (peer.iceConnectionState == 'connected') return;

            (window as any).Echo.join(`handshake.${meetingCode}`)
                .whisper('negotiation', {
                    data: JSON.stringify({
                        type: 'candidate',
                        data: event.candidate
                    }),
                    sender_id: userId,
                    reciver_id: targetId
                })
        };

        peer.ontrack = async (event) => {
            const remoteStream = event.streams[0];
            setRemoteStreams(prevStreams => ({
                ...prevStreams,
                [targetId]: remoteStream
            }));
        }



        peer.onsignalingstatechange = () => {
            console.log(`${targetId} : signalingState ${peer.signalingState}`);
        };

        peer.onconnectionstatechange = () => {
            console.log(`${targetId} : iceConnectionState ${peer.iceConnectionState}`);

            if (peer.iceConnectionState === 'disconnected' ||
                peer.iceConnectionState === 'failed' ||
                peer.iceConnectionState === 'closed') {
                reNegotiation(targetId);
            }
        };

        peer.oniceconnectionstatechange = () => {
            if (peer.iceConnectionState === "failed") {
                peer.restartIce();
            }
        }

        peersRef.current[targetId] = peer;
        return peer;
    }

    const removePeer = (targetId: number) => {
        const peer = peersRef.current[targetId];
        if (!peer) return console.error(`${targetId} : removePeer no peer found.`)
        peer.ontrack = null;
        peer.onicecandidate = null;
        peer.onsignalingstatechange = null;
        peer.onconnectionstatechange = null;

        peer.close();
        delete peersRef.current[targetId];
        const emptyStream = new MediaStream();
        setRemoteStreams(prevStreams => ({
            ...prevStreams,
            [targetId]: emptyStream,
        }));

        console.log("DESTROY " + targetId);
    }

    const createOffer = async (targetId: number, stream?: MediaStream) => {

        let peer = peersRef.current[targetId];
        if (!peer) {
            peer = await createPeer(targetId, stream);
        }
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        (window as any).Echo.join(`handshake.${meetingCode}`)
            .whisper('negotiation', {
                data: JSON.stringify(offer),
                sender_id: userId,
                reciver_id: targetId
            })
    }




    const handleIncomingOffer = async (sender_id: number, offer: RTCSessionDescriptionInit) => {
        const peer = peersRef.current[sender_id];
        if (!peer) return console.error(`${sender_id} : handleIncomingOffer no peer found.`);
        if (peer.signalingState !== 'stable') return;

        await peer.setRemoteDescription(offer);

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        (window as any).Echo.join(`handshake.${meetingCode}`)
            .whisper('negotiation', {
                data: JSON.stringify(answer),
                sender_id: userId,
                reciver_id: sender_id
            })
    }

    const handleIncomingAnswer = async (sender_id: number, answer: RTCSessionDescriptionInit) => {
        const peer = peersRef.current[sender_id];
        if (!peer) return console.error(`${sender_id} : handleIncomingAnswer no peer found.`);
        await peer.setRemoteDescription(answer);
    }

    const handleIncomingCandidate = async (sender_id: number, candidate: RTCIceCandidate) => {
        const peer = peersRef.current[sender_id];
        if (!peer) return console.error(`${sender_id} : handleIncomingCandidate no peer found.`);
        if (!candidate) return console.log(`${sender_id} : handleIncomingCandidate candidate null.`);
        if (peer.iceConnectionState === 'connected') return
        await peer.addIceCandidate(candidate);
    }

    const reNegotiation = async (targetId: number) => {
        if (renegotiatingRef.current) return;

        // Set renegotiatingRef to true to avoid multiple re-negotiation attempts
        renegotiatingRef.current = true;

        let peer = peersRef.current[targetId];

        const offer = await peer.createOffer({ iceRestart: true });
        await peer.setLocalDescription(offer);

        (window as any).Echo.join(`handshake.${meetingCode}`)
            .whisper('negotiation', {
                data: JSON.stringify(offer),
                sender_id: userId,
                reciver_id: targetId
            })

        renegotiatingRef.current = false;
    }

    const replaceRemotesStream = (newStream: MediaStream | null, audioEnabled: boolean, videoEnabled: boolean) => {
        Object.keys(peersRef.current).forEach(async targetId => {
            const peer = peersRef.current[parseInt(targetId)];

            if (newStream) {
                newStream.getTracks().forEach(track => {
                    peer.addTrack(track, newStream);
                })
            } else {
                peer.getSenders().forEach(sender => {
                    if (sender.track && (sender.track.kind === 'audio' || sender.track.kind === 'video')) {
                        peer.removeTrack(sender);
                    }
                });
            }

            reNegotiation(parseInt(targetId));
        });
    }

    const shareScreen = async () => {
        try {
            setIsScreenSharing(true);
            const videoToggleState = isVideoOff;
            const screenStream = await navigator.mediaDevices.getDisplayMedia();
            const screenVideoTrack = screenStream.getVideoTracks()[0];
            const existingVideoTrack = localStream.getVideoTracks()[0];
            if (existingVideoTrack) {
                localStream.removeTrack(existingVideoTrack);
                existingVideoTrack.stop();
            }
            localStream.addTrack(screenVideoTrack);
            setIsVideoOff(false);
            replaceRemotesStream(screenStream, !isAudioMuted, true);


            screenVideoTrack.onended = async () => {
                setIsScreenSharing(false);

                const newStream = await createStream({ video: !videoToggleState, audio: !isAudioMuted });
                if (!newStream) return console.log("Share Screen newStream not found.");
                setLocalStream(newStream);
                setIsVideoOff(videoToggleState);
                replaceRemotesStream(newStream, isAudioMuted, isVideoOff);

            };

        } catch (error) {
            setIsScreenSharing(false);
            console.error('Error sharing screen:', error);
        }
    };


    const toggleMic = async () => {
        if (isToggling == 'audio') return;
        if (isVideoOff && !isAudioMuted) {
            localStream.getTracks().forEach(track => track.stop());
            replaceRemotesStream(null, false, false);
            setLocalStream(new MediaStream());
            setIsToggling(null);
            setIsAudioMuted(prevValue => !prevValue);
            return;
        }

        setIsToggling('audio');

        localStream.getTracks().forEach(track => track.stop());
        const newStream = await createStream({ audio: isAudioMuted, video: !isVideoOff });
        if (!newStream) return console.log("newStream not found on toggle mic")
        setLocalStream(newStream);
        replaceRemotesStream(newStream, isAudioMuted, !isVideoOff);

        setIsAudioMuted(prevValue => !prevValue);
        setIsToggling(null);
    };


    const toggleVideo = async () => {
        if (isToggling === 'video') return;

        setIsToggling('video');

        if (isAudioMuted && !isVideoOff) {
            localStream.getTracks().forEach(track => track.stop());
            replaceRemotesStream(null, false, false);
            setLocalStream(new MediaStream());
            setIsToggling(null);
            setIsVideoOff(prevValue => !prevValue);
            return;
        }

        localStream.getTracks().forEach(track => track.stop());

        const newStream = await createStream({ video: isVideoOff, audio: !isAudioMuted });
        if (!newStream) return console.log("newStream not found on toggle Video")

        setLocalStream(newStream);
        replaceRemotesStream(newStream, !isAudioMuted, isVideoOff);

        setIsVideoOff(prevValue => !prevValue);
        setIsToggling(null);
    };



    useEffect(() => {
        if (meetingCode) {
            (window as any).Echo.join(`handshake.${meetingCode}`)
                .listenForWhisper("negotiation", async ({ sender_id, reciver_id, data }: { sender_id: number, reciver_id: number, data: string }) => {
                    if (reciver_id != userId) return;

                    try {
                        const JSON_DATA = JSON.parse(data);
                        console.log(JSON_DATA.type);

                        if (JSON_DATA.type === 'offer') {
                            handleIncomingOffer(sender_id, JSON_DATA);
                        }

                        if (JSON_DATA.type === 'answer') {
                            handleIncomingAnswer(sender_id, JSON_DATA);
                        }

                        if (JSON_DATA.type === 'candidate') {
                            handleIncomingCandidate(sender_id, JSON_DATA.data);
                        }

                    } catch (error) {
                        console.error('handshake:error', error);
                    }
                })
        }

        return () => {
            (window as any).Echo.leave(`handshake.${meetingCode}`);
        }
    }, [meetingCode, peersRef]);



    useEffect(() => {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !isAudioMuted;
        }
    }, [isAudioMuted]);


    useEffect(() => {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !isVideoOff;
        }
    }, [isVideoOff]);


    useEffect(() => {
        if (isScreenSharing) {
            shareScreen();
        }
    }, [isScreenSharing]);


    return {
        isAudioMuted,
        isVideoOff,
        isScreenSharing,
        setIsScreenSharing,
        createPeer,
        removePeer,
        createOffer,
        createMyVideoStream,
        destroyConnection,
        localStream,
        remoteStreams,
        isToggling,
        toggleMic,
        toggleVideo
    }
}
