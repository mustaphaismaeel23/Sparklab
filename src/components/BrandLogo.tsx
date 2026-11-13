import Image from 'next/image';

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export default function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/sparklab-logo.png"
      alt="SPARKLAB CREATIVITY AND INNOVATION HUB"
      width={326}
      height={240}
      priority={priority}
      className={className}
    />
  );
}
