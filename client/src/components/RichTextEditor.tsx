import { useEffect, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  height?: string;
}

// Configure Quill toolbar with the specified buttons
const modules = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['link'],
    [{ 'size': ['small', false, 'large'] }],
    ['image'],
    ['clean'] // Remove formatting button
  ],
  history: {
    delay: 1000,
    maxStack: 500,
    userOnly: true
  }
};

// Allowed formats
const formats = [
  'bold', 'italic', 'underline',
  'list', 'bullet',
  'align',
  'link',
  'size',
  'image'
];

// DOMPurify configuration
const sanitizeConfig = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'span', 'img'],
  ALLOWED_ATTR: ['href', 'style', 'src', 'alt', 'class'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'iframe', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter description...",
  required = false,
  disabled = false,
  readOnly = false,
  className,
  height = "200px"
}: RichTextEditorProps) {
  const quillRef = useRef<ReactQuill>(null);

  // Handle change event from Quill
  const handleChange = (html: string) => {
    if (!quillRef.current) return;
    
    const editor = quillRef.current.getEditor();
    const text = editor.getText().trim();
    
    // Sanitize HTML before passing to parent
    const sanitizedHtml = DOMPurify.sanitize(html, sanitizeConfig);
    
    onChange(sanitizedHtml, text);
  };

  // Validate content
  const validateContent = () => {
    if (!required) return true;
    
    if (!quillRef.current) return false;
    
    const editor = quillRef.current.getEditor();
    const text = editor.getText().trim();
    
    // Check if content is empty or only whitespace
    if (text.length === 0) {
      return false;
    }
    
    // Check if content is only HTML formatting without actual text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = value;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    return textContent.trim().length > 0;
  };

  // Add custom styles for the editor and fix toolbar button behavior
  useEffect(() => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      
      // Set minimum height
      const editorContainer = editor.container;
      if (editorContainer) {
        editorContainer.style.minHeight = height;
        editorContainer.style.maxHeight = '400px';
        editorContainer.style.overflowY = 'auto';
      }
      
      // Prevent toolbar buttons from submitting forms
      const toolbar = editorContainer.previousSibling as HTMLElement;
      if (toolbar && toolbar.classList.contains('ql-toolbar')) {
        const buttons = toolbar.querySelectorAll('button');
        buttons.forEach(button => {
          button.type = 'button';
          button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
          });
        });
      }
    }
  }, [height]);

  return (
    <div className={cn("rich-text-editor-wrapper", className)}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly || disabled}
        className={cn(
          "bg-white rounded-md border",
          disabled && "opacity-50 cursor-not-allowed",
          "quill-editor"
        )}
      />
      <style jsx global>{`
        .quill-editor .ql-container {
          min-height: ${height};
          max-height: 400px;
          overflow-y: auto;
          font-size: 14px;
        }
        
        .quill-editor .ql-toolbar {
          border-top-left-radius: 0.375rem;
          border-top-right-radius: 0.375rem;
          border-bottom: 1px solid #e5e7eb;
          background-color: #f9fafb;
        }
        
        .quill-editor .ql-container {
          border-bottom-left-radius: 0.375rem;
          border-bottom-right-radius: 0.375rem;
        }
        
        .quill-editor.ql-snow {
          border-color: #e5e7eb;
        }
        
        .quill-editor.ql-snow:focus-within {
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        /* Custom toolbar button styles */
        .ql-toolbar .ql-stroke {
          stroke: #6b7280;
        }
        
        .ql-toolbar .ql-fill,
        .ql-toolbar .ql-stroke.ql-fill {
          fill: #6b7280;
        }
        
        .ql-toolbar button:hover .ql-stroke,
        .ql-toolbar button.ql-active .ql-stroke {
          stroke: #2563eb;
        }
        
        .ql-toolbar button:hover .ql-fill,
        .ql-toolbar button:hover .ql-stroke.ql-fill,
        .ql-toolbar button.ql-active .ql-fill,
        .ql-toolbar button.ql-active .ql-stroke.ql-fill {
          fill: #2563eb;
        }
        
        /* Ensure proper spacing */
        .rich-text-editor-wrapper {
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}

// Component for displaying formatted HTML in view mode
export function RichTextDisplay({ html, className }: { html: string; className?: string }) {
  // Sanitize HTML before rendering
  const sanitizedHtml = DOMPurify.sanitize(html, sanitizeConfig);
  
  return (
    <div 
      className={cn("rte-content prose prose-sm max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    >
    </div>
  );
}