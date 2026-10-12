"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Icon } from "../Icon";
import { IconName } from "@/enums";

function isEmptyHtml(html: string): boolean {
  return html === "" || html === "<p></p>";
}

// The formatting both the editor and the read-only view support — only
// what the toolbar can reach (see RichTextEditor's doc comment).
function contentExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      blockquote: false,
      orderedList: false,
      horizontalRule: false,
    }),
  ];
}

const CONTENT_CLASSES = "[&_ul]:list-disc [&_ul]:pl-5 [&_p]:m-0";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  ariaLabel: string;
  /** "tall" for a page's main writing area (e.g. the Strategy tab's notes). */
  size?: "default" | "tall";
}

/**
 * A minimal rich text editor (bold/italic/bullet list) built on TipTap,
 * standing in for a plain `<textarea>` on the Team Report page's Notes and
 * Weaknesses fields. Stores/emits HTML rather than plain text — a legacy
 * plain-text value (from before this replaced the textarea) still loads and
 * displays fine, since TipTap treats an un-tagged string as one paragraph of
 * text. Only the formatting reachable from the toolbar (bold/italic/bullet
 * list) is enabled — heading, code block, blockquote, ordered list, and
 * horizontal rule are switched off so there's no formatting a user could
 * trigger (e.g. via markdown-style input rules) with no toolbar control to
 * undo it from.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  ariaLabel,
  size = "default",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [...contentExtensions(), Placeholder.configure({ placeholder })],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": ariaLabel,
        class: `${size === "tall" ? "min-h-96 max-h-[48rem]" : "min-h-20 max-h-64"} w-full overflow-y-auto rounded-b-lg border border-t-0 border-zinc-200 bg-zinc-100 p-2 text-sm text-zinc-800 focus:outline-none ${CONTENT_CLASSES} [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-zinc-400 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Only pushed into the editor when the incoming value differs from what
  // the editor itself last emitted (e.g. switching to a different team) —
  // calling setContent on every keystroke's own onUpdate echo would reset
  // the cursor position mid-typing. isEmptyHtml treats "" (an unset
  // notes/weaknesses field) and TipTap's own empty-doc HTML ("<p></p>") as
  // the same value, so a never-edited field doesn't get setContent called on
  // every render.
  if (editor && !editor.isDestroyed) {
    const html = editor.getHTML();
    const same = html === value || (isEmptyHtml(html) && isEmptyHtml(value));
    if (!same) editor.commands.setContent(value, { emitUpdate: false });
  }

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
    }),
  });

  if (!editor) return null;

  return (
    <div>
      <div className="flex items-center gap-0.5 rounded-t-lg border border-zinc-200 bg-zinc-50 p-1">
        <ToolbarButton
          label="Bold"
          icon={IconName.FormatBold}
          active={toolbarState?.bold ?? false}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Italic"
          icon={IconName.FormatItalic}
          active={toolbarState?.italic ?? false}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="Bullet list"
          icon={IconName.FormatListBulleted}
          active={toolbarState?.bulletList ?? false}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: IconName;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded ${
        active ? "bg-zinc-600 dark:bg-zinc-400 text-white" : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
      }`}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

/**
 * Rich text from RichTextEditor shown as formatted text, not an editor —
 * e.g. a shared report's team overview, which its viewers can't edit. Uses
 * TipTap read-only rather than injecting the HTML, so only the formatting
 * the editor supports ever renders (the HTML may come from someone else).
 */
export function RichTextView({ html, className = "" }: { html: string; className?: string }) {
  const editor = useEditor({
    extensions: contentExtensions(),
    content: html,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: `text-sm text-zinc-800 focus:outline-none ${CONTENT_CLASSES} ${className}` },
    },
  });

  if (editor && !editor.isDestroyed && editor.getHTML() !== html) {
    editor.commands.setContent(html, { emitUpdate: false });
  }

  return <EditorContent editor={editor} />;
}
