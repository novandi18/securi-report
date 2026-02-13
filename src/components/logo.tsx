import darkLogo from "@/assets/logos/defenditDark.svg";
import logo from "@/assets/logos/defenditLight.svg";
import Image from "next/image";

export function Logo() {
  return (
    <div className="relative">
      <Image
        src={logo}
        width={1024}
        height={285}
        className="h-8 w-auto dark:hidden"
        alt="DefendIT logo"
        role="presentation"
        quality={100}
      />

      <Image
        src={darkLogo}
        width={1024}
        height={285}
        className="hidden h-8 w-auto dark:block"
        alt="DefendIT logo"
        role="presentation"
        quality={100}
      />
    </div>
  );
}
