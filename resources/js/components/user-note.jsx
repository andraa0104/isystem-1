import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { router } from '@inertiajs/react';
import axios from 'axios';
import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Quote,
    RotateCcw,
    Save,
    Type,
    Underline,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function UserNote() {
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [lastSaved, setLastSaved] = useState(null);
    const [isDirty, setIsDirty] = useState(false);
    const editorRef = useRef(null);
    const saveTimeoutRef = useRef(null);
    const isDirtyRef = useRef(false);
    const hasInitializedRef = useRef(false);

    useEffect(() => {
        isDirtyRef.current = isDirty;
    }, [isDirty]);

    useEffect(() => {
        fetchNote();

        const removeStartListener = router.on('start', () => {
            if (isDirtyRef.current) {
                handleSave();
            }
        });

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            removeStartListener();
        };
    }, []);

    const fetchNote = async () => {
        try {
            const response = await axios.get('/dashboard/user-note');
            const fetchedContent = response.data.content || '';

            // Only set innerHTML if we haven't already and the editor exists
            if (editorRef.current && !hasInitializedRef.current) {
                editorRef.current.innerHTML = fetchedContent;
                hasInitializedRef.current = true;
            }
        } catch (error) {
            console.error('Failed to fetch note:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (forceContent = null) => {
        if (!editorRef.current) return;

        const contentToSave =
            forceContent !== null ? forceContent : editorRef.current.innerHTML;

        setIsSaving(true);
        try {
            await axios.post('/dashboard/user-note', {
                content: contentToSave,
            });
            setLastSaved(new Date());
            setIsDirty(false);
        } catch (error) {
            console.error('Failed to save note:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleInput = () => {
        if (!isDirty) setIsDirty(true);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            handleSave();
        }, 2000); // Auto-save after 2 seconds
    };

    const execCommand = (command, value = null) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
        handleInput();
    };

    if (isLoading) {
        return (
            <Card className="flex h-full flex-col">
                <CardHeader>
                    <div className="h-6 w-32 animate-pulse rounded bg-muted" />
                </CardHeader>
                <CardContent className="flex-1">
                    <div className="h-full w-full animate-pulse rounded bg-muted" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="flex h-full flex-col overflow-hidden border-sidebar-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 px-4 py-3">
                <div className="flex flex-col">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Type className="h-4 w-4" />
                        Catatan Saya
                        {isDirty && (
                            <span
                                className="h-2 w-2 animate-pulse rounded-full bg-amber-400"
                                title="Belum disimpan"
                            />
                        )}
                    </CardTitle>
                    {lastSaved && (
                        <span className="text-[10px] text-muted-foreground">
                            Terakhir disimpan:{' '}
                            {lastSaved.toLocaleTimeString('id-ID')}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                            hasInitializedRef.current = false;
                            fetchNote();
                        }}
                        title="Muat ulang"
                    >
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={
                            'h-8 w-8 ' +
                            (isSaving
                                ? 'text-muted-foreground'
                                : isDirty
                                  ? 'text-amber-500 hover:bg-amber-50 hover:text-amber-600'
                                  : 'text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600')
                        }
                        onClick={() => handleSave()}
                        disabled={isSaving}
                        title="Simpan"
                    >
                        <Save
                            className={
                                isSaving ? 'h-4 w-4 animate-spin' : 'h-4 w-4'
                            }
                        />
                    </Button>
                </div>
            </CardHeader>
            <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b bg-muted/10 p-1.5">
                <ToolbarButton
                    icon={<Bold className="h-4 w-4" />}
                    onClick={() => execCommand('bold')}
                    title="Bold"
                />
                <ToolbarButton
                    icon={<Italic className="h-4 w-4" />}
                    onClick={() => execCommand('italic')}
                    title="Italic"
                />
                <ToolbarButton
                    icon={<Underline className="h-4 w-4" />}
                    onClick={() => execCommand('underline')}
                    title="Underline"
                />
                <div className="mx-1 h-4 w-px bg-sidebar-border/70" />
                <ToolbarButton
                    icon={<List className="h-4 w-4" />}
                    onClick={() => execCommand('insertUnorderedList')}
                    title="Bullet List"
                />
                <ToolbarButton
                    icon={<ListOrdered className="h-4 w-4" />}
                    onClick={() => execCommand('insertOrderedList')}
                    title="Numbered List"
                />
                <div className="mx-1 h-4 w-px bg-sidebar-border/70" />
                <ToolbarButton
                    icon={<Quote className="h-4 w-4" />}
                    onClick={() => execCommand('formatBlock', 'blockquote')}
                    title="Quote"
                />
            </div>
            <CardContent className="relative min-h-[300px] flex-1 p-0">
                <div
                    ref={editorRef}
                    contentEditable
                    className="no-scrollbar prose prose-sm dark:prose-invert absolute inset-0 max-w-none overflow-y-auto p-4 outline-none"
                    onBlur={() => handleSave()}
                    onInput={handleInput}
                    suppressContentEditableWarning={true}
                />
            </CardContent>
        </Card>
    );
}

function ToolbarButton({ icon, onClick, title }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
            {icon}
        </button>
    );
}
