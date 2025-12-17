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

    setStatusText("Uploading the file...");
    const uploadedFile = await fs.upload([file]);
    if (!uploadedFile) return setStatusText("Error: Failed to upload file");

    setStatusText("Converting to image...");
    const imageFile = await convertPdfToImage(file);
    if (!imageFile.file) {
      const errorMsg = imageFile.error || "Unknown error";
      console.error("PDF conversion error:", errorMsg);
      return setStatusText(
        `Error: Failed to convert PDF to image - ${errorMsg}`
      );
    }

    setStatusText("Uploading the image...");
    const uploadedImage = await fs.upload([imageFile.file]);
    if (!uploadedImage) return setStatusText("Error: Failed to upload image");

    setStatusText("Preparing data...");
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

    setStatusText("Analyzing...");

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
            `Analyzing with ${model}... (${i + 1}/${models.length})`
          );

          progressInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - modelStartTime) / 1000);
            setStatusText(`Analyzing with ${model}... (${elapsed}s elapsed)`);
          }, 5000);

          let timeoutId: NodeJS.Timeout;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              if (progressInterval) clearInterval(progressInterval);
              reject(
                new Error(`Analysis timed out after 60 seconds with ${model}`)
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
            setStatusText(`Trying alternative model...`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      if (!feedback) {
        throw lastError || new Error("All models failed to provide feedback");
      }

      const feedbackText =
        typeof feedback.message.content === "string"
          ? feedback.message.content
          : feedback.message.content?.[0]?.text;

      if (!feedbackText) {
        console.error("No feedback text found in response:", feedback);
        return setStatusText(
          "Error: Failed to analyze resume - Invalid response format"
        );
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
          "Error: Failed to parse analysis response. Please try again."
        );
      }

      data.feedback = parsedFeedback;
      await kv.set(`resume:${uuid}`, JSON.stringify(data));
      setStatusText("Analysis complete, redirecting...");
      navigate(`/resume/${uuid}`);
    } catch (error: any) {
      console.error("Analysis error:", error);
      const errorMessage =
        error?.message || "Unknown error occurred during analysis";
      return setStatusText(`Error: ${errorMessage}`);
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
          <h1>Smart feedback for your dream job</h1>
          {isProcessing ? (
            <>
              <h2>{statusText}</h2>
              <img src="/images/resume-scan.gif" className="w-full" />
            </>
          ) : (
            <h2>Drop your resume for an ATS score and improvement tips</h2>
          )}
          {!isProcessing && (
            <form
              id="upload-form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 mt-8"
            >
              <div className="form-div">
                <label htmlFor="company-name">Company Name</label>
                <input
                  type="text"
                  name="company-name"
                  placeholder="Company Name"
                  id="company-name"
                />
              </div>
              <div className="form-div">
                <label htmlFor="job-title">Job Title</label>
                <input
                  type="text"
                  name="job-title"
                  placeholder="Job Title"
                  id="job-title"
                />
              </div>
              <div className="form-div">
                <label htmlFor="job-description">Job Description</label>
                <textarea
                  rows={5}
                  name="job-description"
                  placeholder="Job Description"
                  id="job-description"
                />
              </div>

              <div className="form-div">
                <label htmlFor="uploader">Upload Resume</label>
                <FileUploader onFileSelect={handleFileSelect} />
              </div>

              <button className="primary-button" type="submit">
                Analyze Resume
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
