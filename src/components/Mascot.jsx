import Lottie from 'lottie-react';
import botRunning from '@/assets/bot_running.json';

export default function Mascot({
  className = '',
  style,
  loop = true,
  autoplay = true,
  ...rest
}) {
  return (
    <Lottie
      animationData={botRunning}
      loop={loop}
      autoplay={autoplay}
      className={className}
      style={style}
      rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
      {...rest}
    />
  );
}
