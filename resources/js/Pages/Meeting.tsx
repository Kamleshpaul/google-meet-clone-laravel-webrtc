import { Head } from "@inertiajs/react";
import PrimaryButton from "@/Components/PrimaryButton";
import { AiOutlineAudio, AiOutlineAudioMuted } from "react-icons/ai";
import { BsCameraVideo, BsCameraVideoOff } from "react-icons/bs";
import { LuScreenShare, LuScreenShareOff } from "react-icons/lu";
import { MdCall } from "react-icons/md";
import { HiPhoneMissedCall } from "react-icons/hi";
import { useWebRTC, WebRTCState } from "@/hooks/useWebRTC";
import { PageProps } from "@/types";

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
        isCallMissed,
        setIsCallMissed,
        localStream,
        remoteStreams
    }: WebRTCState = useWebRTC({ meetingId: id, userId: auth?.user?.id });

    const toggleAudio = () => {
        setIsAudioMuted(!isAudioMuted);
    };

    const toggleVideo = async () => {
        setIsVideoOff(!isVideoOff);
    };

    const toggleScreenSharing = () => {
        setIsScreenSharing(!isScreenSharing);
    };

    const toggleCall = () => {
        setIsCallMissed(!isCallMissed);
    };


    return (
        <div className="relative w-screen h-screen bg-black opacity-90">
            <Head title="Meeting" />

            <div className="absolute text-sm font-bold text-white bottom-20 left-10">
                {auth?.user.name || ""}
            </div>

            {/* Video grid container */}
            <div
                className="grid h-full grid-cols-1 gap-2 px-10 pt-10 pb-32 sm:grid-cols-2 md:grid-cols-3"
            >
                <video
                    className="w-full h-full rounded"
                    autoPlay
                    muted
                    ref={(videoRef) => {
                        if (videoRef) {
                            videoRef.srcObject = localStream;
                        }
                    }}
                />

                {Object.keys(remoteStreams).map((id) => {
                    return (
                        <video
                            key={id}
                            id={id}
                            className="w-full h-full rounded"
                            autoPlay
                            muted
                            ref={(videoRef) => {
                                if (videoRef) {
                                    videoRef.srcObject = remoteStreams[parseInt(id)];
                                }
                            }}
                        />
                    )
                })}


            </div>

            {/*footer*/}
            <div className="absolute grid w-screen grid-cols-3 px-10 text-white bottom-5">
                <div className="flex">
                    <div className="mr-1 cursor-not-allowed">
                        {new Date().toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}{" "}
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

                    <PrimaryButton onClick={toggleScreenSharing}>
                        {isScreenSharing ? (
                            <LuScreenShareOff className="w-5 h-5" />
                        ) : (
                            <LuScreenShare className="w-5 h-5" />
                        )}
                    </PrimaryButton>

                    <PrimaryButton onClick={toggleCall}>
                        {isCallMissed ? (
                            <HiPhoneMissedCall className="w-5 h-5" />
                        ) : (
                            <MdCall className="w-5 h-5" />
                        )}
                    </PrimaryButton>
                </div>

                <div className="text-right">
                    <PrimaryButton >Chat</PrimaryButton>
                </div>
            </div>
            {/*footer*/}
        </div>
    );
}
