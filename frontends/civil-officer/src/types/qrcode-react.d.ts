declare module "qrcode.react" {
  import type { ComponentType, SVGAttributes } from "react";

  export type QRCodeSVGProps = SVGAttributes<SVGSVGElement> & {
    value: string;
    size?: number;
    bgColor?: string;
    fgColor?: string;
    level?: "L" | "M" | "Q" | "H";
    includeMargin?: boolean;
  };

  export const QRCodeSVG: ComponentType<QRCodeSVGProps>;
  export const QRCodeCanvas: ComponentType<QRCodeSVGProps>;
}
