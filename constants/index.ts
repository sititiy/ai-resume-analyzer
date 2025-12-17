export const resumes: Resume[] = [
  {
    id: "1",
    companyName: "Google",
    jobTitle: "Frontend Developer",
    imagePath: "images/resume_01.png",
    resumePath: "/resumes/resume-1.pdf",
    feedback: {
      overallScore: 85,
      ATS: {
        score: 90,
        tips: [],
      },
      toneAndStyle: {
        score: 90,
        tips: [],
      },
      content: {
        score: 90,
        tips: [],
      },
      structure: {
        score: 90,
        tips: [],
      },
      skills: {
        score: 90,
        tips: [],
      },
    },
  },
  {
    id: "2",
    companyName: "Microsoft",
    jobTitle: "Cloud Engineer",
    imagePath: "images/resume_02.png",
    resumePath: "/resumes/resume-2.pdf",
    feedback: {
      overallScore: 55,
      ATS: {
        score: 90,
        tips: [],
      },
      toneAndStyle: {
        score: 90,
        tips: [],
      },
      content: {
        score: 90,
        tips: [],
      },
      structure: {
        score: 90,
        tips: [],
      },
      skills: {
        score: 90,
        tips: [],
      },
    },
  },
  {
    id: "3",
    companyName: "Apple",
    jobTitle: "iOS Developer",
    imagePath: "images/resume_03.png",
    resumePath: "/resumes/resume-3.pdf",
    feedback: {
      overallScore: 75,
      ATS: {
        score: 90,
        tips: [],
      },
      toneAndStyle: {
        score: 90,
        tips: [],
      },
      content: {
        score: 90,
        tips: [],
      },
      structure: {
        score: 90,
        tips: [],
      },
      skills: {
        score: 90,
        tips: [],
      },
    },
  },
];

export const AIResponseFormat = `
        interface Feedback {
        overallScore: number; //max 100
        ATS: {
          score: number; //rate based on ATS suitability
          tips: {
            type: "good" | "improve";
            tip: string; //give 3-4 tips
          }[];
        };
        toneAndStyle: {
          score: number; //max 100
          tips: {
            type: "good" | "improve";
            tip: string; //make it a short "title" for the actual explanation
            explanation: string; //explain in detail here
          }[]; //give 3-4 tips
        };
        content: {
          score: number; //max 100
          tips: {
            type: "good" | "improve";
            tip: string; //make it a short "title" for the actual explanation
            explanation: string; //explain in detail here
          }[]; //give 3-4 tips
        };
        structure: {
          score: number; //max 100
          tips: {
            type: "good" | "improve";
            tip: string; //make it a short "title" for the actual explanation
            explanation: string; //explain in detail here
          }[]; //give 3-4 tips
        };
        skills: {
          score: number; //max 100
          tips: {
            type: "good" | "improve";
            tip: string; //make it a short "title" for the actual explanation
            explanation: string; //explain in detail here
          }[]; //give 3-4 tips
        };
      }`;

export const prepareInstructions = ({
  jobTitle,
  jobDescription,
  AIResponseFormat,
}: {
  jobTitle: string;
  jobDescription: string;
  AIResponseFormat?: string;
}) =>
  `شما یک متخصص در سیستم ردیابی متقاضی (ATS) و تحلیل رزومه هستید.
    لطفاً این رزومه را تحلیل و ارزیابی کنید و پیشنهاداتی برای بهبود آن ارائه دهید.
    اگر رزومه ضعیف است، می‌توانید امتیاز پایین بدهید.
    کامل و دقیق باشید. از اشاره به اشتباهات یا نقاط قابل بهبود نترسید.
    اگر موارد زیادی برای بهبود وجود دارد، در دادن امتیاز پایین تردید نکنید. این برای کمک به کاربر در بهبود رزومه است.
    در صورت وجود، از توضیحات شغل برای شغلی که کاربر برای آن درخواست می‌دهد استفاده کنید تا بازخورد دقیق‌تری ارائه دهید.
    در صورت ارائه، توضیحات شغل را در نظر بگیرید.
    عنوان شغل: ${jobTitle}
    توضیحات شغل: ${jobDescription}
    بازخورد را با استفاده از فرمت زیر ارائه دهید: ${AIResponseFormat}
    تحلیل را به صورت یک شیء JSON برگردانید، بدون هیچ متن دیگری و بدون بک‌تیک.
    هیچ متن یا کامنت دیگری اضافه نکنید.
    مهم: تمام متن‌های بازخورد، نکات، توضیحات و پیشنهادات باید به زبان فارسی باشند.`;
