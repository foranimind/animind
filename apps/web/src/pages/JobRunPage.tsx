import { useParams } from "react-router-dom";

export const JobRunPage = () => {
  const { id } = useParams();

  return (
    <div className="page job-run-page">
      <h1>任务运行中</h1>
      <p>任务 ID: {id ?? "未知"}</p>
    </div>
  );
};
