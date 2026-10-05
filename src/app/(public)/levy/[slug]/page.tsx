import { explainerRoute } from "@/components/explainers/explainer-route";

export const revalidate = 3600;

const route = explainerRoute("levy");

export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
