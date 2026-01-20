import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import { Transition } from '@headlessui/react';
import { Form, Head, usePage } from '@inertiajs/react';
import DeleteUser from '@/components/delete-user';
import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit } from '@/routes/profile';
const breadcrumbs = [
    {
        title: 'Profile settings',
        href: edit().url,
    },
];
export default function Profile({ mustVerifyEmail, status, }) {
    const { auth } = usePage().props;
    return (<AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Profile settings"/>

            <h1 className="sr-only">Profile Settings</h1>

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall title="Profile information" description="Update your name and contact information"/>

                    <Form {...ProfileController.update.form()} options={{
            preserveScroll: true,
        }} className="space-y-6">
                        {({ processing, recentlySuccessful, errors }) => (<>
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Name</Label>

                                    <Input id="name" className="mt-1 block w-full" defaultValue={auth.user.name} name="name" required autoComplete="name" placeholder="Full name"/>

                                    <InputError className="mt-2" message={errors.name}/>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="phone">Nomor HP</Label>

                                    <Input id="phone" className="mt-1 block w-full" defaultValue={auth.user.phone} name="phone" autoComplete="tel" placeholder="Nomor HP"/>

                                    <InputError className="mt-2" message={errors.phone}/>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="username">Username</Label>

                                    <Input id="username" className="mt-1 block w-full" defaultValue={auth.user.username} name="username" required autoComplete="username" placeholder="Username"/>

                                    <InputError className="mt-2" message={errors.username}/>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="level">Level User</Label>
                                    <Input id="level" className="mt-1 block w-full" value={auth.user.level ?? '-'} readOnly/>
                                </div>

                                <div className="flex items-center gap-4">
                                    <Button disabled={processing} data-test="update-profile-button">
                                        Save
                                    </Button>

                                    <Transition show={recentlySuccessful} enter="transition ease-in-out" enterFrom="opacity-0" leave="transition ease-in-out" leaveTo="opacity-0">
                                        <p className="text-sm text-neutral-600">
                                            Saved
                                        </p>
                                    </Transition>
                                </div>
                            </>)}
                    </Form>
                </div>

                <DeleteUser />
            </SettingsLayout>
        </AppLayout>);
}
