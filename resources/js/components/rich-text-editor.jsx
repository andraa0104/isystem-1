import { Bold, Italic, List, ListOrdered, Underline } from 'lucide-react';
import { useEffect, useRef } from 'react';

const allowedTags = new Set([
    'B',
    'BR',
    'DIV',
    'EM',
    'I',
    'LI',
    'OL',
    'P',
    'STRONG',
    'U',
    'UL',
]);

const normalizeHtml = (html) => {
    if (typeof document === 'undefined') return html ?? '';

    const container = document.createElement('div');
    container.innerHTML = html ?? '';

    const clean = (node) => {
        [...node.childNodes].forEach((child) => {
            if (child.nodeType !== Node.ELEMENT_NODE) return;

            if (!allowedTags.has(child.tagName)) {
                child.replaceWith(...child.childNodes);
                clean(node);
                return;
            }

            [...child.attributes].forEach((attribute) => {
                if (
                    !(
                        (child.tagName === 'OL' &&
                            attribute.name.toLowerCase() === 'type') ||
                        (child.tagName === 'UL' &&
                            attribute.name.toLowerCase() === 'data-list-style')
                    )
                ) {
                    child.removeAttribute(attribute.name);
                }
            });

            if (
                child.tagName === 'OL' &&
                !['1', 'A', 'a'].includes(child.getAttribute('type'))
            ) {
                child.removeAttribute('type');
            }

            if (
                child.tagName === 'UL' &&
                child.getAttribute('data-list-style') !== 'dash'
            ) {
                child.removeAttribute('data-list-style');
            }

            if (
                child.tagName === 'UL' &&
                child.getAttribute('data-list-style') === 'dash'
            ) {
                child.style.listStyleType = '"- "';
            }

            clean(child);
        });
    };

    clean(container);
    return container.innerHTML;
};

const richTextTagPattern =
    /<\/?(?:b|br|div|em|i|li|ol|p|strong|u|ul)(?:\s[^>]*)?>/i;

const renderRemarkNode = (node, key) => {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return null;

    const children = [...node.childNodes].map((child, index) =>
        renderRemarkNode(child, `${key}-${index}`),
    );

    switch (node.tagName) {
        case 'B':
        case 'STRONG':
            return <strong key={key}>{children}</strong>;
        case 'I':
        case 'EM':
            return <em key={key}>{children}</em>;
        case 'U':
            return <u key={key}>{children}</u>;
        case 'BR':
            return <br key={key} />;
        case 'DIV':
        case 'P':
            return <div key={key}>{children}</div>;
        case 'UL': {
            const isDashList = node.getAttribute('data-list-style') === 'dash';
            return (
                <ul
                    key={key}
                    className="my-1 pl-5"
                    style={
                        isDashList
                            ? { listStyleType: '"- "' }
                            : { listStyleType: 'disc' }
                    }
                >
                    {children}
                </ul>
            );
        }
        case 'OL': {
            const type = node.getAttribute('type');
            const listStyle =
                type === 'A'
                    ? 'list-[upper-alpha]'
                    : type === 'a'
                      ? 'list-[lower-alpha]'
                      : 'list-decimal';
            return (
                <ol
                    key={key}
                    type={['1', 'A', 'a'].includes(type) ? type : undefined}
                    className={`my-1 pl-5 ${listStyle}`}
                >
                    {children}
                </ol>
            );
        }
        case 'LI':
            return <li key={key}>{children}</li>;
        default:
            return children;
    }
};

export function FormattedRemark({ value, className = '' }) {
    const text = value?.toString() ?? '';

    if (!text) return '-';

    if (typeof document === 'undefined' || !richTextTagPattern.test(text)) {
        return <div className={`whitespace-pre-wrap ${className}`}>{text}</div>;
    }

    const container = document.createElement('div');
    container.innerHTML = text;

    return (
        <div className={`whitespace-pre-wrap ${className}`}>
            {[...container.childNodes].map((node, index) =>
                renderRemarkNode(node, index),
            )}
        </div>
    );
}

export default function RichTextEditor({ id, value, onChange }) {
    const editorRef = useRef(null);

    useEffect(() => {
        if (
            !editorRef.current ||
            document.activeElement === editorRef.current
        ) {
            return;
        }

        const normalizedValue = normalizeHtml(value);
        if (editorRef.current.innerHTML !== normalizedValue) {
            editorRef.current.innerHTML = normalizedValue;
        }
    }, [value]);

    const updateValue = () => {
        const html = normalizeHtml(editorRef.current?.innerHTML ?? '');
        if (editorRef.current && editorRef.current.innerHTML !== html) {
            editorRef.current.innerHTML = html;
        }
        onChange(html);
    };

    const runCommand = (command, commandValue = null) => {
        editorRef.current?.focus();
        document.execCommand(command, false, commandValue);
        updateValue();
    };

    const getSelectedList = (selector) => {
        const selection = window.getSelection();
        let element = selection?.anchorNode;
        if (element?.nodeType !== Node.ELEMENT_NODE) {
            element = element?.parentElement;
        }
        return element?.closest(selector);
    };

    const setDashList = () => {
        const existingList = getSelectedList('ul');
        if (existingList) {
            existingList.setAttribute('data-list-style', 'dash');
        } else {
            runCommand('insertUnorderedList');
            getSelectedList('ul')?.setAttribute('data-list-style', 'dash');
        }
        updateValue();
    };

    const setOrderedListType = (type) => {
        const existingList = getSelectedList('ol');
        if (existingList) {
            existingList.setAttribute('type', type);
        } else {
            runCommand('insertOrderedList');
            getSelectedList('ol')?.setAttribute('type', type);
        }
        updateValue();
    };

    const getAutoListContext = (pendingSpace) => {
        const selection = window.getSelection();
        if (!selection?.isCollapsed || !editorRef.current) return null;

        const textNode = selection.anchorNode;
        if (textNode?.nodeType !== Node.TEXT_NODE) return null;

        const cursorOffset = selection.anchorOffset;
        const marker = `${textNode.textContent.slice(0, cursorOffset)}${
            pendingSpace ? ' ' : ''
        }`;

        let block = textNode.parentElement;
        while (
            block &&
            block !== editorRef.current &&
            !['DIV', 'P', 'LI'].includes(block.tagName)
        ) {
            block = block.parentElement;
        }

        return {
            marker,
            selection,
            target:
                block === editorRef.current &&
                cursorOffset === textNode.textContent.length
                    ? textNode
                    : block,
        };
    };

    const applyAutoList = (pendingSpace = false) => {
        const context = getAutoListContext(pendingSpace);
        if (!context?.target) return false;

        const { marker, selection, target } = context;
        const numericMatch = marker.match(/^(\d+)\.\s(.*)$/);
        const alphabeticMatch = marker.match(/^([a-zA-Z])\.\s(.*)$/);
        const dashMatch = marker.match(/^-\s(.*)$/);
        const isDash = Boolean(dashMatch);

        if (!numericMatch && !alphabeticMatch && !isDash) return false;

        const itemText =
            numericMatch?.[2] ?? alphabeticMatch?.[2] ?? dashMatch?.[1] ?? '';

        const list = document.createElement(isDash ? 'ul' : 'ol');
        if (isDash) {
            list.setAttribute('data-list-style', 'dash');
        } else {
            list.setAttribute(
                'type',
                alphabeticMatch
                    ? alphabeticMatch[1] === alphabeticMatch[1].toLowerCase()
                        ? 'a'
                        : 'A'
                    : '1',
            );
        }

        const item = document.createElement('li');
        item.append(itemText || document.createElement('br'));
        list.append(item);

        if (target === editorRef.current) {
            target.replaceChildren(list);
        } else {
            target.replaceWith(list);
        }

        const range = document.createRange();
        range.selectNodeContents(item);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        updateValue();

        return true;
    };

    const removeCurrentListFormatting = () => {
        const selection = window.getSelection();
        if (!selection?.isCollapsed) return false;

        let element = selection.anchorNode;
        if (element?.nodeType !== Node.ELEMENT_NODE) {
            element = element?.parentElement;
        }

        const item = element?.closest('li');
        const list = item?.parentElement;
        if (!item || !['OL', 'UL'].includes(list?.tagName)) return false;

        const rangeBeforeCaret = selection.getRangeAt(0).cloneRange();
        rangeBeforeCaret.selectNodeContents(item);
        rangeBeforeCaret.setEnd(selection.anchorNode, selection.anchorOffset);
        if (rangeBeforeCaret.toString().length > 0) return false;

        const isEmptyItem = item.textContent.trim() === '';
        const listType = list.getAttribute('type');
        const listMarker =
            list.tagName === 'UL'
                ? '- '
                : `${listType === 'a' || listType === 'A' ? listType : '1'}. `;
        const paragraph = document.createElement('div');
        while (item.firstChild) paragraph.append(item.firstChild);
        if (isEmptyItem) {
            paragraph.replaceChildren(listMarker);
        } else if (!paragraph.childNodes.length) {
            paragraph.append(document.createElement('br'));
        }

        const items = [...list.children];
        const itemIndex = items.indexOf(item);
        const previousItems = items.slice(0, itemIndex);
        const followingItems = items.slice(itemIndex + 1);
        const fragment = document.createDocumentFragment();

        if (previousItems.length) {
            const previousList = list.cloneNode(false);
            previousItems.forEach((listItem) => previousList.append(listItem));
            fragment.append(previousList);
        }

        fragment.append(paragraph);

        if (followingItems.length) {
            const followingList = list.cloneNode(false);
            followingItems.forEach((listItem) =>
                followingList.append(listItem),
            );
            fragment.append(followingList);
        }

        list.replaceWith(fragment);

        const range = document.createRange();
        range.selectNodeContents(paragraph);
        range.collapse(!isEmptyItem);
        selection.removeAllRanges();
        selection.addRange(range);
        updateValue();

        return true;
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Backspace' && removeCurrentListFormatting()) {
            event.preventDefault();
            return;
        }

        if (
            (event.key === ' ' || event.code === 'Space') &&
            applyAutoList(true)
        ) {
            event.preventDefault();
        }
    };

    const handlePaste = (event) => {
        event.preventDefault();
        const text = event.clipboardData?.getData('text/plain') ?? '';
        document.execCommand('insertText', false, text);
        updateValue();
    };

    const ToolbarButton = ({ icon, label, onClick }) => (
        <button
            type="button"
            title={label}
            aria-label={label}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
        >
            {icon}
        </button>
    );

    return (
        <div className="overflow-hidden rounded-md border border-sidebar-border/70 bg-background">
            <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-1.5">
                <ToolbarButton
                    icon={<Bold className="h-4 w-4" />}
                    label="Bold"
                    onClick={() => runCommand('bold')}
                />
                <ToolbarButton
                    icon={<Italic className="h-4 w-4" />}
                    label="Italic"
                    onClick={() => runCommand('italic')}
                />
                <ToolbarButton
                    icon={<Underline className="h-4 w-4" />}
                    label="Underline"
                    onClick={() => runCommand('underline')}
                />
                <span className="mx-1 h-4 w-px bg-sidebar-border/70" />
                <ToolbarButton
                    icon={<ListOrdered className="h-4 w-4" />}
                    label="Numbering angka"
                    onClick={() => setOrderedListType('1')}
                />
                <button
                    type="button"
                    title="Numbering huruf"
                    aria-label="Numbering huruf"
                    className="rounded px-1.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setOrderedListType('A')}
                >
                    A.
                </button>
                <span className="mx-1 h-4 w-px bg-sidebar-border/70" />
                <ToolbarButton
                    icon={<List className="h-4 w-4" />}
                    label="Bullet"
                    onClick={() => runCommand('insertUnorderedList')}
                />
                <button
                    type="button"
                    title="Format strip (-)"
                    aria-label="Format strip (-)"
                    className="rounded px-1.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={setDashList}
                >
                    -
                </button>
            </div>
            <div
                id={id}
                ref={editorRef}
                contentEditable
                role="textbox"
                aria-multiline="true"
                className="min-h-24 px-3 py-2 text-sm outline-none [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol[type='A']]:list-[upper-alpha] [&_ol[type='a']]:list-[lower-alpha] [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
                onInput={() => {
                    applyAutoList();
                    updateValue();
                }}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                suppressContentEditableWarning
            />
        </div>
    );
}
