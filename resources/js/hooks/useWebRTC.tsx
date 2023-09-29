import axios from 'axios';
import { useEffect, useRef, useState } from 'react';


const servers = {
    iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] },
    ],
};



export interface WebRTCState {
    isAudioMuted: boolean;
    setIsAudioMuted: React.Dispatch<React.SetStateAction<boolean>>;
    isVideoOff: boolean;
    setIsVideoOff: React.Dispatch<React.SetStateAction<boolean>>;
    isScreenSharing: boolean;
    setIsScreenSharing: React.Dispatch<React.SetStateAction<boolean>>;
    isCallMissed: boolean;
    setIsCallMissed: React.Dispatch<React.SetStateAction<boolean>>;
    createOffer: (targetId: number, stream: MediaStream) => void;
    removePeer: (targetId: number) => void;
    createPeer: (targetId: number, stream: MediaStream) => Promise<RTCPeerConnection>;
    videoContainerRef: React.RefObject<HTMLDivElement>;
    createMyVideoStream: () => Promise<MediaStream | undefined>
}

export function useWebRTC({ userId }: { userId: number }): WebRTCState {
    const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
    const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
    const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
    const [isCallMissed, setIsCallMissed] = useState<boolean>(false);

    const videoContainerRef = useRef<HTMLDivElement | null>(null);
    const peersRef = useRef<Record<number, RTCPeerConnection>>([]);


    const createVideoContainer = (id: number, stream: MediaStream) => {
        const oldVideoElement = document.getElementById(id.toString());
        oldVideoElement?.remove();
        const videoElement = document.createElement("video");
        videoElement.id = id.toString();
        videoElement.className = "w-full h-full rounded";
        videoElement.autoplay = true;
        videoElement.muted = true;
        videoElement.srcObject = stream;
        videoContainerRef.current?.append(videoElement);
    };

    const createMyVideoStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            createVideoContainer(userId, stream)
            return stream;

        } catch (error) {
            console.error('Error  accessing camera and microphone :', error);
        }
    };


    const createPeer = async (targetId: number, stream: MediaStream): Promise<RTCPeerConnection> => {
        const peer = new RTCPeerConnection(servers);

        stream.getTracks().forEach(track => {
            peer.addTrack(track, stream);
        })


        peer.onicecandidate = (event) => {
            if (!event.candidate) return console.log(`${targetId} : ICE Gathering  Complete`);

            axios.post(route("handshake"), {
                reciver_id: targetId,
                data: JSON.stringify({
                    type: 'candidate',
                    data: event.candidate
                }),
            });

        };

        peer.ontrack = async (event) => {
            createVideoContainer(targetId, event.streams[0]);
        }

        peer.onsignalingstatechange = () => {
            console.log(`${targetId} : ${peer.signalingState}`);
        };

        peer.onconnectionstatechange = () => {
            console.log(`${targetId} : ${peer.iceConnectionState}`);

            if (peer.iceConnectionState === 'disconnected' ||
                peer.iceConnectionState === 'failed' ||
                peer.iceConnectionState === 'closed') {
                reNegotiation(targetId);
            }
        };


        peersRef.current[targetId] = peer;
        return peer;
    }

    const removePeer = (targetId: number) => {
        const PC = peersRef.current[targetId];
        if (!PC) return console.error(`${targetId} : removePeer no peer found.`)

        PC.close();
        delete peersRef.current[targetId];
        const oldVideoElement = document.getElementById(targetId.toString());
        oldVideoElement?.remove();

    }

    const createOffer = async (targetId: number, stream: MediaStream) => {

        let peer = peersRef.current[targetId];
        if (!peer) {
            peer = await createPeer(targetId, stream);
        }
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        await axios.post(route("handshake"), {
            reciver_id: targetId,
            data: JSON.stringify(offer),
        });
    }




    const handleIncomingOffer = async (sender_id: number, offer: RTCSessionDescriptionInit) => {
        const peer = peersRef.current[sender_id];
        if (!peer) return console.error(`${sender_id} : handleIncomingOffer no peer found.`);

        await peer.setRemoteDescription(offer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await axios.post(route("handshake"), {
            reciver_id: sender_id,
            data: JSON.stringify(answer),
        });


    }

    const handleIncomingAnswer = async (sender_id: number, answer: RTCSessionDescriptionInit) => {
        const peer = peersRef.current[sender_id];
        if (!peer) return console.error(`${sender_id} : handleIncomingAnswer no peer found.`);

        await peer.setRemoteDescription(answer);

        if (peer.iceConnectionState !== 'connected') {
            reNegotiation(sender_id);
        }

    }

    const handleIncomingCandidate = async (sender_id: number, candidate: RTCIceCandidate) => {
        const peer = peersRef.current[sender_id];
        if (!peer) return console.error(`${sender_id} : handleIncomingCandidate no peer found.`);

        await peer.addIceCandidate(candidate);
    }

    const reNegotiation = async (targetId: number) => {
        const peer = peersRef.current[targetId];
        if (!peer) return console.error(`ERROR  ON reNegotiation no peer ${targetId} found.`);

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await axios.post(route("handshake"), {
            reciver_id: targetId,
            data: JSON.stringify(offer),
        });
    }

    useEffect(() => {
        if (userId) {
            (window as any).Echo.private(`handshake.${userId}`)
                .listen("SendHandShake", async ({ sender_id, data }: { sender_id: number, data: string }) => {
                    try {
                        const JSON_DATA = JSON.parse(data);
                        if (JSON_DATA.type === 'offer') {
                            handleIncomingOffer(sender_id, JSON_DATA);
                        }

                        if (JSON_DATA.type === 'answer') {
                            handleIncomingAnswer(sender_id, JSON_DATA);
                        }

                        if (JSON_DATA.type === 'candidate') {
                            handleIncomingCandidate(sender_id, JSON_DATA);
                        }

                    } catch (error) {
                        console.error('handshake:error', error);
                    }
                })
        }

        return () => {
            (window as any).Echo.leave(`handshake.${userId}`);
        }
    }, [userId, peersRef]);


    // useEffect(() => {
    //     const audioTrack = localStream.getAudioTracks()[0];
    //     if(audioTrack){

    //         audioTrack.enabled = !audioTrack.enabled;
    //     }
    // }, [isAudioMuted])

    // useEffect(() => {
    //     const videoTrack = localStream.getVideoTracks()[0];
    //     if (videoTrack) {
    //         videoTrack.enabled = !videoTrack.enabled;
    //     }
    // }, [isVideoOff])

    return {
        isAudioMuted,
        setIsAudioMuted,
        isVideoOff,
        setIsVideoOff,
        isScreenSharing,
        setIsScreenSharing,
        isCallMissed,
        setIsCallMissed,
        videoContainerRef,
        createPeer,
        removePeer,
        createOffer,
        createMyVideoStream
    }
}