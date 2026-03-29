import { DeliveryPage } from "./DeliveryPage";

type DetailPageProps = { jobId?: string };

export const DetailPage = ({ jobId }: DetailPageProps) => <DeliveryPage jobId={jobId} />;
