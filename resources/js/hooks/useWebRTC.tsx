import { User } from '@/types';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import Peer, { SignalData } from 'simple-peer';


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
    remoteStreams: { [key: number]: MediaStream }
}

export function useWebRTC({ meetingId, userId }: { meetingId: string; userId: number }): WebRTCState {
    const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
    const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
    const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
    const [isCallMissed, setIsCallMissed] = useState<boolean>(false);
    const [users, setUsers] = useState<User[]>([]);

    const [localStream, setLocalStream] = useState<MediaStream>(new MediaStream());
    const [remoteStreams, setRemoteStreams] = useState<{ [key: number]: MediaStream }>({});
    const peersRef = useRef<Record<string, Peer.Instance>>({});

    
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

    const createPeer = (targetId: number) => {
        const peer = new Peer({
            initiator: true,
            trickle: true,
            stream: localStream,
            config:servers
        });

        peer.on('signal', async (signal) => {
            await axios.post(route("handshake"), {
                reciver_id: targetId,
                data: JSON.stringify(signal),
            });
        });
        peer.on('disconnect', () => {
            peer.destroy();
        });

        peer.on('stream', stream => {
            console.log(" got stream Remote ");
            setRemoteStreams(prevState => ({
                ...prevState,
                [targetId]: stream,
            }));
        })

        console.log("createPeer for " + targetId);
        peersRef.current[targetId] = peer;

        return peer;
    }

    const addPeer = (targetId: number, offer?: SignalData) => {
        const peer = new Peer({
            initiator: false,
            trickle: true,
            stream: localStream,
            config:servers
        });

        peer.on('signal', async (signal) => {
            // sent answer to other user
            await axios.post(route("handshake"), {
                reciver_id: targetId,
                data: JSON.stringify(signal),
            });
        });

        peer.on('disconnect', () => {
            peer.destroy();
        });
        if (offer) {
            peer.signal(offer);
            console.log(" CONNECTED ");
        }

        peer.on('stream', stream => {
            console.log(" got stream Remote ");
            setRemoteStreams(prevState => ({
                ...prevState,
                [targetId]: stream,
            }));
        })

        console.log("createPeer for " + targetId);
        peersRef.current[targetId] = peer;
        return peer;
    }

    const removePeer = (targetId: number) => {
        const peerId = findPeer(targetId);
        if (!peerId) return;
        peerId.destroy();
        delete peersRef.current[targetId];
        console.log('removed---------->>>>>>>', { peersRef: peersRef.current });
    }

    const handleIncomingOffer = (sender_id: number, offer: SignalData) => {
        const peerId = findPeer(sender_id);
        console.log({ peerId })
        if (peerId) {
            addPeer(sender_id, offer);
        }
    }

    const handleIncomingAnswer = (sender_id: number, answer: SignalData) => {
        const peerId = findPeer(sender_id);
        if (peerId) {
            // accept answer
            peerId.signal(answer);
        }
    }
    const handleIncomingCandidate = (sender_id: number, candidate: SignalData) => {
        const peerId = findPeer(sender_id);
        if (peerId) {
            peerId.signal(candidate);
        }
    }

    useEffect(() => {
        if (userId) {
            createMyVideoStream();
            (window as any).Echo.private(`handshake.${userId}`)
                .listen("SendHandShake", async ({ sender_id, data }: { sender_id: number, data: string }) => {
                    try {
                        const JSON_DATA: SignalData = JSON.parse(data);
                        if (JSON_DATA.type === 'offer') {
                            console.log("GOT  offer")
                            handleIncomingOffer(sender_id, JSON_DATA);
                        }

                        if (JSON_DATA.type === 'answer') {
                            console.log("GOT answer")
                            handleIncomingAnswer(sender_id, JSON_DATA);
                        }

                        if (JSON_DATA.type === 'candidate') {
                            console.log("GOT candidate ")
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

    useEffect(() => {
        if (meetingId) {
            (window as any).Echo.join(`meeting.${meetingId}`)
                .here(async (users: User[]) => {
                    users.map(async user => {
                        if (user.id !== userId) {
                            createPeer(user.id);
                            console.log("Creating  offer and sending offer");
                        }
                    })
                })
                .joining(async (user: User) => {
                    setUsers(prevState => [...prevState, user]);
                    addPeer(user.id);
                    console.log("Don't create offer it will recive offer");
                })
                .leaving((user: User) => {
                    setUsers(prevState => prevState.filter(x => x.id !== user.id));
                    removePeer(user.id)
                    console.log("leaving user " + user.id);
                })
                .error((error: any) => {
                    console.error({ error });
                });
        }
        return () => {
            (window as any).Echo.leave(`meeting.${meetingId}`);
        }
    }, [])

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
        remoteStreams

    }
}