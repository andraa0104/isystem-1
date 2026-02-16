import InputError from '@/components/input-error';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { Transition } from '@headlessui/react';
import { Form, Head } from '@inertiajs/react';
import { useRef } from 'react';
import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { edit } from '@/routes/user-password';
const breadcrumbs = [
    {
        title: 'Password settings',
        href: edit(),
    },
];
export default function Password() {
    const passwordInput = useRef(null);
    const currentPasswordInput = useRef(null);
    const passwordUpdateForm = { action: '/settings/password', method: 'put' };
    return (<AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Password settings"/>

            <h1 className="sr-only">Password Settings</h1>

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall title="Update password" description="Ensure your account is using a long, random password to stay secure"/>

                    <Form {...passwordUpdateForm} options={{
            preserveScroll: true,
        }} resetOnError={[
            'password',
            'current_password',
        ]} resetOnSuccess onError={(errors) => {
            var _a, _b;
            if (errors.password) {
                (_a = passwordInput.current) === null || _a === void 0 ? void 0 : _a.focus();
            }
            if (errors.current_password) {
                (_b = currentPasswordInput.current) === null || _b === void 0 ? void 0 : _b.focus();
            }
        }} className="space-y-6">
                        {({ errors, processing, recentlySuccessful }) => (<>
                                <div className="grid gap-2">
                                    <Label htmlFor="current_password">
                                        Current password
                                    </Label>

                                    <Input id="current_password" ref={currentPasswordInput} name="current_password" type="password" className="mt-1 block w-full" autoComplete="current-password" placeholder="Current password"/>

                                    <InputError message={errors.current_password}/>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="password">
                                        New password
                                    </Label>

                                    <Input id="password" ref={passwordInput} name="password" type="password" className="mt-1 block w-full" autoComplete="new-password" placeholder="New password"/>

                                    <InputError message={errors.password}/>
                                </div>

                                <div className="flex items-center gap-4">
                                    <Button disabled={processing} data-test="update-password-button">
                                        Save password
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
            </SettingsLayout>
        </AppLayout>);
}
