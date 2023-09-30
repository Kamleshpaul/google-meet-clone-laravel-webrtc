import { Head, router } from "@inertiajs/react";
import PrimaryButton from "@/Components/PrimaryButton";
import { AiOutlineAudio, AiOutlineAudioMuted, AiOutlineClose, AiOutlineCopy } from "react-icons/ai";
import { BsCameraVideo, BsCameraVideoOff } from "react-icons/bs";
import { LuScreenShare, LuScreenShareOff } from "react-icons/lu";
import { HiPhoneMissedCall } from "react-icons/hi";
import { useWebRTC, WebRTCState } from "@/hooks/useWebRTC";
import { PageProps, User } from "@/types";
import { useEffect, useState } from "react";
import Moment from "react-moment";
import { useToast } from '@chakra-ui/react'

interface MeetingProps extends PageProps {
    id: string;
}

export default function Meeting({ auth, id }: MeetingProps) {
    const {
        isAudioMuted,
        setIsAudioMuted,
        isVideoOff,
        setIsVideoOff,
        isScreenSharing,
        setIsScreenSharing,
        videoContainerRef,
        createOffer,
        createPeer,
        removePeer,
        createMyVideoStream,
        destroyConnection
    }: WebRTCState = useWebRTC({ userId: auth?.user?.id });

    const toast = useToast()

    const [showInviteModal, setshowInviteModal] = useState(true);

    const toggleAudio = () => {
        setIsAudioMuted(!isAudioMuted);
    };

    const toggleVideo = async () => {
        setIsVideoOff(!isVideoOff);
    };

    const toggleScreenSharing = () => {
        setIsScreenSharing(!isScreenSharing);
    };

    const endCall = () => {
        destroyConnection();
        toast({
            title: 'Call End.',
            status:"success",
            position:"top-right",
            variant: 'left-accent',
            duration: 2000,
            isClosable: true,
        })
        router.visit(`/dashboard`);
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(window.location.href);
        toast({
            title: 'Copied.',
            status:"success",
            position:"top-right",
            variant: 'left-accent',
            duration: 2000,
            isClosable: true,
        })
    }

    useEffect(() => {
        const initializeVideoStream = async () => {
            const stream = await createMyVideoStream();

            if (!stream) {
                return alert('No Video and Audio found.')
            }

            toast({
                title: 'Call Started.',
                status:"success",
                position:"top-right",
                variant: 'left-accent',
                duration: 2000,
                isClosable: true,
            })
            if (id) {
                (window as any).Echo.join(`meeting.${id}`)
                    .here(async (users: User[]) => {
                        users.map(async (user) => {
                            if (user.id !== auth.user.id) {
                                await createPeer(user.id, stream);
                            }
                        });
                    })
                    .joining(async (user: User) => {
                        if (stream) {
                            createOffer(user.id, stream);
                        }
                    })
                    .leaving((user: User) => {
                        removePeer(user.id);
                    })
                    .error((error: any) => {
                        console.error({ error });
                    });
            }
        };

        initializeVideoStream();

        return () => {
            (window as any).Echo.leave(`meeting.${id}`);
        };
    }, [id]);


    return (
        <div className="relative w-screen h-screen bg-black opacity-90">
            <Head title="Meeting" />

            <div className="absolute text-sm font-bold text-white bottom-20 left-10">
                {auth?.user.name || ""}
            </div>

            {/* Video grid container */}
            <div ref={videoContainerRef}
                className="grid h-full grid-cols-1 gap-2 px-10 pt-10 pb-32 sm:grid-cols-2 md:grid-cols-3">

            </div>
            {/* Video grid container */}

            {/*footer*/}
            <div className="absolute grid w-screen grid-cols-3 px-10 text-white bottom-5">
                <div className="flex">
                    <div className="mr-1 cursor-not-allowed">
                        <Moment className="mr-1" format="h:mm A" />

                        |
                    </div>
                    <div>{id}</div>
                </div>

                <div className="space-x-2 text-center">
                    <PrimaryButton onClick={toggleAudio}>
                        {isAudioMuted ? (
                            <AiOutlineAudioMuted className="w-5 h-5" />
                        ) : (
                            <AiOutlineAudio className="w-5 h-5" />
                        )}
                    </PrimaryButton>

                    <PrimaryButton onClick={toggleVideo}>
                        {isVideoOff ? (
                            <BsCameraVideoOff className="w-5 h-5" />
                        ) : (
                            <BsCameraVideo className="w-5 h-5" />
                        )}
                    </PrimaryButton>

                    <PrimaryButton
                        onClick={toggleScreenSharing}
                        disabled={isScreenSharing}
                    >
                        {isScreenSharing ? (
                            <LuScreenShareOff className="w-5 h-5" />
                        ) : (
                            <LuScreenShare className="w-5 h-5" />
                        )}
                    </PrimaryButton>

                    <PrimaryButton onClick={endCall}>
                        <HiPhoneMissedCall className="w-5 h-5" />
                    </PrimaryButton>
                </div>

                <div className="text-right">
                    <PrimaryButton >Chat</PrimaryButton>
                </div>
            </div>
            {/*footer*/}


            {/*pop new meeting*/}
            <div className={`absolute p-5 bg-white rounded-lg w-80 bottom-20 left-10 ${showInviteModal ? '' : 'hidden'}`}>
                <div className="flex justify-between mb-5">
                    <h1 className="text-lg font-bold text">Your meeting's ready</h1>
                    <button onClick={() => { setshowInviteModal(false) }}><AiOutlineClose /></button>
                </div>

                <p className="mb-5 text-sm">Share this meeting link with others you want in the meeting</p>

                <div className="flex justify-between p-3 mb-5 bg-gray-200 rounded">
                    <div className="text-lg text">{window.location.pathname.substring(1)}</div>
                    <button onClick={handleCopy} >
                        <AiOutlineCopy className="cursor-pointer w-7 h-7" />
                    </button>

                </div>

            </div>
            {/*pop new meeting*/}

        </div>
    );
}
