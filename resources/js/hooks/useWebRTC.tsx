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
    localStream: MediaStream,
    remoteStreams: { [key: number]: MediaStream },
    createOffer: (targetId: number) => void
    createPeer: (targetId: number) => Promise<RTCPeerConnection>
}

export function useWebRTC({ userId }: { userId: number }): WebRTCState {
    const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
    const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
    const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
    const [isCallMissed, setIsCallMissed] = useState<boolean>(false);

    const [localStream, setLocalStream] = useState<MediaStream>(new MediaStream());
    const [remoteStreams, setRemoteStreams] = useState<{ [key: number]: MediaStream }>({});
    const peersRef = useRef<Record<number, RTCPeerConnection>>({});


    const createMyVideoStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
        } catch (error) {
            console.error('Error accessing camera and microphone :', error);
        }
    };

    const findPeer = (id: number) => {
        return peersRef.current[id];
    }

    const createPeer = async (targetId: number): Promise<RTCPeerConnection> => {
        return new Promise(async (resolve) => {
            const peer = new RTCPeerConnection(servers);

            localStream.getTracks().forEach((track) => {
                peer.addTrack(track, localStream);
            });

            peer.onicecandidate = (event) => {
                if (event.candidate) {
                    axios.post(route("handshake"), {
                        reciver_id: targetId,
                        data: JSON.stringify({
                            type: 'candidate',
                            data: event.candidate
                        }),
                    });
                }
            };

            peer.ontrack = async (event) => {

                console.log("GOT TRACK " + targetId);   
            }

            peer.onconnectionstatechange = () => {
                console.log(`${peer.iceConnectionState} for ${targetId}`)
            };

            peer.onsignalingstatechange = () => {
                console.log(`${peer.signalingState} for ${targetId}`)
            };
            

            peersRef.current[targetId] = peer;
            resolve(peer);
        });
    }


    const createOffer = async (targetId: number) => {

        let peer = findPeer(targetId);
        if (!peer) {
            peer = await createPeer(targetId);
        }
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        await axios.post(route("handshake"), {
            reciver_id: targetId,
            data: JSON.stringify(offer),
        });
    }




    const handleIncomingOffer = async (sender_id: number, offer: RTCSessionDescriptionInit) => {
        const peer = findPeer(sender_id);
        if (peer) {

            await peer.setRemoteDescription(offer);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);

            await axios.post(route("handshake"), {
                reciver_id: sender_id,
                data: JSON.stringify(answer),
            });

        } else {
            console.error(`ERROR ON handleIncomingOffer no peer ${sender_id} found.`);
        }
    }

    const handleIncomingAnswer = async (sender_id: number, answer: RTCSessionDescriptionInit) => {
        const peer = findPeer(sender_id);
        if (peer) {
            await peer.setRemoteDescription(answer);
        } else {
            console.error(`ERROR  ON handleIncomingAnswer no peer ${sender_id} found.`);
        }
    }

    const handleIncomingCandidate = async (sender_id: number, candidate: RTCIceCandidate) => {
        const peer = findPeer(sender_id);
        if (peer) {
            await peer.addIceCandidate(candidate);
        } else {
            console.error(`ERROR  ON handleIncomingCandidate no peer ${sender_id} found.`);
        }
    }

    useEffect(() => {
        if (userId) {
            createMyVideoStream();
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
    }, [userId]);


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
        localStream,
        remoteStreams,
        createPeer,
        createOffer
    }
}