export default function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      class={checked ? 'rc-switch rc-switch-checked' : 'rc-switch'}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
    >
      <span class="rc-switch-inner" />
    </button>
  );
}
