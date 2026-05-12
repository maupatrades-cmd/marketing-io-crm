export default function Mascot({ className = '', style, ...rest }) {
  return (
    <img
      src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/064a31584_io_astronaut_transparent.png"
      alt="Marketing iO Mascot"
      className={className}
      style={{ filter: 'drop-shadow(0 4px 16px rgba(167,100,230,0.4))', ...style }}
      {...rest}
    />
  );
}