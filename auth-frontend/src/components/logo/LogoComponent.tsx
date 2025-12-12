import { SVGProps } from "react";

const LogoComponent = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 50"
        {...props}
    >
        <defs>
            <linearGradient id="techWikiGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
        </defs>
        <text
            x="10"
            y="35"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize="28"
            fontWeight="700"
        >
            <tspan fill="url(#techWikiGradient)">Tech</tspan>
            <tspan fill="currentColor">Wiki</tspan>
        </text>
    </svg>
);

export default LogoComponent;
