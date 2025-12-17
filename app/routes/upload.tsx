import { prepareInstructions, AIResponseFormat } from "../../constants/index";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import FileUploader from "~/components/FileUploader";
import Navbar from "~/components/Navbar";
import { convertPdfToImage } from "~/lib/pdf2img";
import { usePuterStore } from "~/lib/puter";
import { generateUUID } from "~/lib/utils";

export default function Upload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { auth, isLoading, fs, ai, kv } = usePuterStore();
  const navigate = useNavigate();

  const handleFileSelect = (file: File | null) => {
    setFile(file);
  };
  const handleAnalyze = async ({
    companyName,
    jobTitle,
    jobDescription,
    file,
  }: {
    companyName: string;
    jobTitle: string;
    jobDescription: string;
    file: File;
  }) => {
    setIsProcessing(true);

    setStatusText("در حال آپلود فایل...");
    const uploadedFile = await fs.upload([file]);
    if (!uploadedFile) return setStatusText("خطا: آپلود فایل ناموفق بود");

    setStatusText("در حال تبدیل به تصویر...");
    const imageFile = await convertPdfToImage(file);
    if (!imageFile.file) {
      const errorMsg = imageFile.error || "خطای نامشخص";
      console.error("PDF conversion error:", errorMsg);
      return setStatusText(`خطا: تبدیل PDF به تصویر ناموفق بود - ${errorMsg}`);
    }

    setStatusText("در حال آپلود تصویر...");
    const uploadedImage = await fs.upload([imageFile.file]);
    if (!uploadedImage) return setStatusText("خطا: آپلود تصویر ناموفق بود");

    setStatusText("در حال آماده‌سازی داده‌ها...");
    const uuid = generateUUID();
    const data = {
      id: uuid,
      resumePath: uploadedFile.path,
      imagePath: uploadedImage.path,
      companyName,
      jobTitle,
      jobDescription,
      feedback: "",
    };
    await kv.set(`resume:${uuid}`, JSON.stringify(data));

    setStatusText("در حال تحلیل...");

    try {
      const models = [
        "claude-3-5-sonnet-20241022",
        "claude-sonnet-4",
        "claude-3-opus-20240229",
      ];
      let feedback: AIResponse | undefined = undefined;
      let lastError: Error | null = null;

      for (let i = 0; i < models.length; i++) {
        const model = models[i];
        const modelStartTime = Date.now();
        let progressInterval: NodeJS.Timeout | undefined;
        try {
          setStatusText(
            `در حال تحلیل با ${model}... (${i + 1}/${models.length})`
          );

          progressInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - modelStartTime) / 1000);
            setStatusText(
              `در حال تحلیل با ${model}... (${elapsed} ثانیه گذشته)`
            );
          }, 5000);

          let timeoutId: NodeJS.Timeout;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              if (progressInterval) clearInterval(progressInterval);
              reject(
                new Error(`تحلیل پس از ۶۰ ثانیه با ${model} به پایان رسید`)
              );
            }, 60000);
          });

          const feedbackPromise = ai
            .feedback(
              uploadedFile.path,
              prepareInstructions({
                jobTitle,
                jobDescription,
                AIResponseFormat,
              }),
              model
            )
            .then((result) => {
              if (timeoutId) clearTimeout(timeoutId);
              return result;
            })
            .catch((error) => {
              if (timeoutId) clearTimeout(timeoutId);
              throw error;
            });

          feedback = await Promise.race([feedbackPromise, timeoutPromise]);

          clearInterval(progressInterval);

          if (feedback) {
            break;
          }
        } catch (error: any) {
          if (typeof progressInterval !== "undefined") {
            clearInterval(progressInterval);
          }
          lastError = error;
          if (i < models.length - 1) {
            setStatusText(`در حال امتحان مدل جایگزین...`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      if (!feedback) {
        throw (
          lastError || new Error("همه مدل‌ها در ارائه بازخورد ناموفق بودند")
        );
      }

      const feedbackText =
        typeof feedback.message.content === "string"
          ? feedback.message.content
          : feedback.message.content?.[0]?.text;

      if (!feedbackText) {
        console.error("No feedback text found in response:", feedback);
        return setStatusText("خطا: تحلیل رزومه ناموفق بود - فرمت پاسخ نامعتبر");
      }

      let parsedFeedback;
      try {
        const cleanedText = feedbackText
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        parsedFeedback = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error("Failed to parse feedback JSON:", parseError);
        console.error("Feedback text:", feedbackText);
        return setStatusText(
          "خطا: تجزیه پاسخ تحلیل ناموفق بود. لطفاً دوباره تلاش کنید."
        );
      }

      data.feedback = parsedFeedback;
      await kv.set(`resume:${uuid}`, JSON.stringify(data));
      setStatusText("تحلیل کامل شد، در حال هدایت...");
      navigate(`/resume/${uuid}`);
    } catch (error: any) {
      console.error("Analysis error:", error);
      const errorMessage = error?.message || "خطای نامشخص در حین تحلیل رخ داد";
      return setStatusText(`خطا: ${errorMessage}`);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget.closest("form");
    if (!form) return;
    const formData = new FormData(form);

    const companyName = formData.get("company-name") as string;
    const jobTitle = formData.get("job-title") as string;
    const jobDescription = formData.get("job-description") as string;

    if (!file) return;

    handleAnalyze({ companyName, jobTitle, jobDescription, file });
  };

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover">
      <Navbar />

      <section className="main-section">
        <div className="page-heading py-16">
          <h1>بازخورد هوشمند برای شغل رویایی شما</h1>
          {isProcessing ? (
            <>
              <h2>{statusText}</h2>
              <img src="/images/resume-scan.gif" className="w-full" />
            </>
          ) : (
            <h2>رزومه خود را برای امتیاز ATS و نکات بهبود رها کنید</h2>
          )}
          {!isProcessing && (
            <form
              id="upload-form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 mt-8"
            >
              <div className="form-div">
                <label htmlFor="company-name">نام شرکت</label>
                <input
                  type="text"
                  name="company-name"
                  placeholder="نام شرکت"
                  id="company-name"
                />
              </div>
              <div className="form-div">
                <label htmlFor="job-title">عنوان شغل</label>
                <input
                  type="text"
                  name="job-title"
                  placeholder="عنوان شغل"
                  id="job-title"
                />
              </div>
              <div className="form-div">
                <label htmlFor="job-description">توضیحات شغل</label>
                <textarea
                  rows={5}
                  name="job-description"
                  placeholder="توضیحات شغل"
                  id="job-description"
                />
              </div>

              <div className="form-div">
                <label htmlFor="uploader">آپلود رزومه</label>
                <FileUploader onFileSelect={handleFileSelect} />
              </div>

              <button className="primary-button" type="submit">
                تحلیل رزومه
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
