import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { PageProps } from '@/types';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import SecondaryButton from '@/Components/SecondaryButton';
import { useState } from 'react';
import useRandomStringGenerator from '@/hooks/useRandomStringGenerator';

export default function Dashboard({ auth }: PageProps) {

    const [meetingId, setMeetingId] = useState('');
    const generateNewRandomString = useRandomStringGenerator();



    const newMeetingHandle = () => {
        const randomString = generateNewRandomString(11);
        router.visit(`/meeting/${randomString}`);

    }

    const handleJoin = () => {
        router.visit(`/meeting/${meetingId}`);
    }

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">Meeting</h2>}
        >
            <Head title="Meeting" />

            <div className="py-12 ">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="bg-white shadow-sm sm:rounded-lg grid  gap-4 grid-cols-1 md:grid-cols-2  h-[34rem] overflow-scroll">


                        <div className="flex flex-col justify-center p-10">
                            <h1 className="text-4xl font-semibold">Premium video meetings.</h1>
                            <h1 className="mb-5 text-4xl font-semibold"> Now free for everyone.</h1>
                            <p>We re-engineered the service we built for secure business meetings, Google Meet, to make it free and available for all.</p>
                            <div className="grid grid-cols-6 gap-2 mt-10 lg:grid-cols-12">
                                <PrimaryButton onClick={newMeetingHandle} className="col-span-4 text-center">
                                    New Meeting
                                </PrimaryButton>
                                <TextInput onChange={(e) => {
                                    setMeetingId(e.target.value)
                                }} className="col-span-4" />
                                <SecondaryButton onClick={handleJoin} className="col-span-2">Join</SecondaryButton>
                            </div>
                        </div>


                        <div className="flex flex-col items-center justify-center p-10 mr-10">
                            <div>
                                <img width="300" src="https://www.gstatic.com/meet/user_edu_get_a_link_light_90698cd7b4ca04d3005c962a3756c42d.svg" />
                            </div>
                            <p className="mb-2 text-2xl">Get a link you can share</p>
                            <div className="text-sm">Click <strong>New meeting</strong> to get a link you can send to people </div>
                            <div className="text-sm">you want to meet with</div>
                        </div>

                    </div>

                </div>
            </div>


        </AuthenticatedLayout>
    );
}
