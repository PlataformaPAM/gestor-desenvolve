"use client";

import "./documento-rich-editor.css";

import { forwardRef, useImperativeHandle, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import clsx from "clsx";

export type DocumentoRichEditorHandle = {
  insertVariable: (token: string) => void;
  insertImageFromUrl: (url: string) => void;
  focusEditor: () => void;
};

export type DocumentoRichEditorProps = {
  initialHtml: string;
  onChange: (html: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  minHeightClassName?: string;
};

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link:", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt("URL da imagem:", "https://");
    if (!url?.trim()) return;
    editor.chain().focus().setImage({ src: url.trim(), alt: "" }).run();
  };

  const btn = (active: boolean, onClick: () => void, children: React.ReactNode, title: string) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={clsx(
        "rounded p-1.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-600",
        active && "bg-slate-200 text-[#6D28D9] dark:bg-slate-600 dark:text-violet-200"
      )}
    >
      {children}
    </button>
  );

  return (
    <div
      className="mb-0 flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 border-slate-200 bg-slate-100 px-1 py-1 dark:border-slate-600 dark:bg-slate-800"
      onMouseDown={(e) => e.preventDefault()}
    >
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <Bold className="h-4 w-4" />, "Negrito")}
      {btn(
        editor.isActive("italic"),
        () => editor.chain().focus().toggleItalic().run(),
        <Italic className="h-4 w-4" />,
        "Itálico"
      )}
      {btn(
        editor.isActive("underline"),
        () => editor.chain().focus().toggleUnderline().run(),
        <UnderlineIcon className="h-4 w-4" />,
        "Sublinhado"
      )}
      {btn(
        editor.isActive("strike"),
        () => editor.chain().focus().toggleStrike().run(),
        <Strikethrough className="h-4 w-4" />,
        "Riscado"
      )}
      <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />
      {btn(
        editor.isActive("heading", { level: 1 }),
        () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        <Heading1 className="h-4 w-4" />,
        "Título 1"
      )}
      {btn(
        editor.isActive("heading", { level: 2 }),
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        <Heading2 className="h-4 w-4" />,
        "Título 2"
      )}
      {btn(
        editor.isActive("heading", { level: 3 }),
        () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        <Heading3 className="h-4 w-4" />,
        "Título 3"
      )}
      <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />
      {btn(
        editor.isActive({ textAlign: "left" }),
        () => editor.chain().focus().setTextAlign("left").run(),
        <AlignLeft className="h-4 w-4" />,
        "Alinhar à esquerda"
      )}
      {btn(
        editor.isActive({ textAlign: "center" }),
        () => editor.chain().focus().setTextAlign("center").run(),
        <AlignCenter className="h-4 w-4" />,
        "Centralizar"
      )}
      {btn(
        editor.isActive({ textAlign: "right" }),
        () => editor.chain().focus().setTextAlign("right").run(),
        <AlignRight className="h-4 w-4" />,
        "Alinhar à direita"
      )}
      {btn(
        editor.isActive({ textAlign: "justify" }),
        () => editor.chain().focus().setTextAlign("justify").run(),
        <AlignJustify className="h-4 w-4" />,
        "Justificar"
      )}
      <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />
      {btn(
        editor.isActive("bulletList"),
        () => editor.chain().focus().toggleBulletList().run(),
        <List className="h-4 w-4" />,
        "Lista com marcadores"
      )}
      {btn(
        editor.isActive("orderedList"),
        () => editor.chain().focus().toggleOrderedList().run(),
        <ListOrdered className="h-4 w-4" />,
        "Lista numerada"
      )}
      {btn(
        false,
        () => editor.chain().focus().setHorizontalRule().run(),
        <Minus className="h-4 w-4" />,
        "Linha horizontal"
      )}
      <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />
      {btn(editor.isActive("link"), setLink, <Link2 className="h-4 w-4" />, "Link")}
      {btn(false, addImage, <ImageIcon className="h-4 w-4" />, "Imagem por URL")}
      <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />
      {btn(
        false,
        () => editor.chain().focus().undo().run(),
        <Undo2 className="h-4 w-4" />,
        "Desfazer"
      )}
      {btn(
        false,
        () => editor.chain().focus().redo().run(),
        <Redo2 className="h-4 w-4" />,
        "Refazer"
      )}
    </div>
  );
}

export const DocumentoRichEditor = forwardRef<DocumentoRichEditorHandle, DocumentoRichEditorProps>(
  function DocumentoRichEditor(
    { initialHtml, onChange, onFocus, placeholder, minHeightClassName = "min-h-[200px]" },
    ref
  ) {
    const extensions = useMemo(
      () => [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          bulletList: { HTMLAttributes: { class: "list-disc pl-5" } },
          orderedList: { HTMLAttributes: { class: "list-decimal pl-5" } },
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { class: "text-[#6D28D9] underline" },
        }),
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        Placeholder.configure({
          placeholder: placeholder ?? "Digite aqui…",
        }),
        Image.configure({
          HTMLAttributes: {
            class: "max-h-24 w-auto rounded object-contain my-2",
          },
        }),
      ],
      [placeholder]
    );

    const editor = useEditor({
      immediatelyRender: false,
      extensions,
      content: initialHtml?.trim() ? initialHtml : "<p></p>",
      editorProps: {
        attributes: {
          class: clsx(
            "tiptap max-w-none px-3 py-2 text-sm text-slate-900 outline-none dark:text-slate-100",
            minHeightClassName
          ),
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChange(ed.getHTML());
      },
      onFocus: () => onFocus?.(),
    });

    useImperativeHandle(
      ref,
      () => ({
        insertVariable: (token: string) => {
          if (!editor) return;
          editor.chain().focus().insertContent(token).run();
        },
        insertImageFromUrl: (url: string) => {
          if (!editor || !url.trim()) return;
          editor.chain().focus().setImage({ src: url.trim(), alt: "Logo" }).run();
        },
        focusEditor: () => {
          editor?.chain().focus().run();
        },
      }),
      [editor]
    );

    return (
      <div className="documento-rich-editor rounded-b-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
        <Toolbar editor={editor} />
        <EditorContent editor={editor} className="documento-editor-content" />
      </div>
    );
  }
);
