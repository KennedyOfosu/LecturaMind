const paths = {
  view: <><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  edit: <><path d="m15 5 4 4" /><path d="M4 20l4.2-.9L19 8.3a2.1 2.1 0 0 0-3-3L5.2 16.1 4 20Z" /></>,
  delete: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="m5 7 1 14h12l1-14M9 7V4h6v3" /></>,
  deactivate: <><circle cx="10" cy="8" r="3" /><path d="M4 20v-1.5a6 6 0 0 1 10.2-4.2" /><path d="m17 16 5 5m0-5-5 5" /></>,
  activate: <><circle cx="10" cy="8" r="3" /><path d="M4 20v-1.5a6 6 0 0 1 10.2-4.2" /><path d="M19 15v6m-3-3h6" /></>,
  remove: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="m5 7 1 14h12l1-14M9 7V4h6v3" /></>,
  assign: <><path d="M12 5v14M5 12h14" /></>,
  finalize: <><path d="m5 12 4 4L19 6" /></>,
  setup: <><path d="M14 3h7v7" /><path d="M10 14 21 3" /><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" /></>,
}

export function AdminActionButton({ icon, label, onClick, tone = 'neutral', disabled = false }) {
  return (
    <button
      type="button"
      className={`admin-action-button is-${tone}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths[icon] || paths.view}
      </svg>
    </button>
  )
}
