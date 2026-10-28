"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

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

const EDITOR_HEIGHTS = {
  default: "min-h-20 max-h-64",
  medium: "min-h-32 max-h-80",
  tall: "min-h-96 max-h-[48rem]",
};

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  ariaLabel: string;
  /**
   * "tall" for a page's main writing area (e.g. the Strategy tab's notes);
   * "medium" to sit beside something about as tall (a game plan's picks).
   */
  size?: "default" | "medium" | "tall";
  /**
   * "bare" for a field that should blend into its card (the Matchup Planner's
   * game plan): no box, and the toolbar only shows while the field has focus
   * (Ctrl/Cmd+B still works without it).
   */
  variant?: "boxed" | "bare";
  /** Read-only, dimmed (e.g. the planner card with no active team). */
  disabled?: boolean;
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
  variant = "boxed",
  disabled = false,
}: RichTextEditorProps) {
  const t = useMessages();
  const editor = useEditor({
    extensions: [...contentExtensions(), Placeholder.configure({ placeholder })],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": ariaLabel,
        class: `${
          variant === "bare"
            ? "min-h-16 max-h-32 rounded-lg"
            : `${EDITOR_HEIGHTS[size]} rounded-b-lg border border-t-0 border-zinc-200 bg-zinc-100`
        } w-full overflow-y-auto p-2 text-sm text-zinc-800 focus:outline-none ${CONTENT_CLASSES} [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-zinc-400 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]`,
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

  // Follows `disabled` after creation (e.g. once an active team is picked).
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEditable === disabled)
      editor.setEditable(!disabled);
  }, [editor, disabled]);

  // The editor is created once, so a changed placeholder (e.g. after
  // switching the app language) is pushed into its extension here.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const extension = editor.extensionManager.extensions.find((ext) => ext.name === "placeholder");
    if (!extension || extension.options.placeholder === placeholder) return;
    extension.options.placeholder = placeholder;
    editor.view.dispatch(editor.state.tr);
  }, [editor, placeholder]);

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
    <div className={cn("group", disabled && "cursor-not-allowed opacity-60")}>
      <div
        className={cn(
          "flex items-center gap-0.5 p-1",
          variant === "bare"
            ? "hidden rounded-lg group-focus-within:flex"
            : "rounded-t-lg border border-zinc-200 bg-zinc-50",
        )}
      >
        <ToolbarButton
          label={t.richText.bold}
          icon={IconName.FormatBold}
          active={toolbarState?.bold ?? false}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label={t.richText.italic}
          icon={IconName.FormatItalic}
          active={toolbarState?.italic ?? false}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label={t.richText.bulletList}
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
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded",
        active ? "bg-chrome-600 text-white" : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700",
      )}
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
      attributes: {
        class: `text-sm text-zinc-800 focus:outline-none ${CONTENT_CLASSES} ${className}`,
      },
    },
  });

  if (editor && !editor.isDestroyed && editor.getHTML() !== html) {
    editor.commands.setContent(html, { emitUpdate: false });
  }

  return <EditorContent editor={editor} />;
}
