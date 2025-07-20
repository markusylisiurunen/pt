type ToggleProps = {
  isActive: boolean;
  onToggle: () => void;
};
const Toggle: React.FC<ToggleProps> = ({ isActive, onToggle }) => {
  return (
    <button className={`toggle ${isActive ? "active" : ""}`.trim()} onClick={() => onToggle()}>
      <span />
    </button>
  );
};

export { Toggle };
