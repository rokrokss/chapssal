import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  fetchAnalyzeResumeStream,
  fetchMatchJob,
  fetchGenerateCoverLetter,
} from '@/services/resume';
import { Loader2 } from 'lucide-react';
import { useAnimatedText } from '@/components/animated-text';
import useResumeStore from '@/store/useResumeStore';
import useSessionStore from '@/store/useSessionStore';
import { Accordion } from '@/components/ui/accordion';
import JobAccordionItem from '@/components/JobAccordionItem';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';

const pdfFormSchema = z.object({
  resumePdf: z.custom<File>(file => file instanceof File && file.type === 'application/pdf', {
    message: 'PDF 파일만 업로드 가능합니다.',
  }),
});

const JobMatcher = () => {
  const navigate = useNavigate();
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const {
    summary,
    matchedJobs,
    coverLetter,
    selectedJobId,
    selectedJobName,
    pdfMode,
    setSummary,
    setMatchedJobs,
    setCoverLetter,
    setSelectedJobId,
    setSelectedJobName,
    setPdfMode,
  } = useResumeStore();
  const { sessionId } = useSessionStore();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [matchedJobsLoading, setMatchedJobsLoading] = useState(false);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetterButtonClicked, setCoverLetterButtonClicked] = useState(false);

  const animatedText = useAnimatedText(summary);
  const animatedCoverLetter = useAnimatedText(coverLetter);
  const [accordianOpen, setAccordionOpen] = useState('');

  const pdfForm = useForm<z.infer<typeof pdfFormSchema>>({
    resolver: zodResolver(pdfFormSchema),
    defaultValues: {
      resumePdf: undefined,
    },
  });

  const getResumeSummaryPdf = async (values: z.infer<typeof pdfFormSchema>) => {
    const reader = await fetchAnalyzeResumeStream(values.resumePdf, sessionId);
    const decoder = new TextDecoder('utf-8');
    if (!reader) return;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const parsed = JSON.parse(chunk.replace(/\n/g, '\\n'));
      const summary = useResumeStore.getState().summary;
      useResumeStore.setState({ summary: summary + parsed['chunk'] });
    }
    setSummaryLoading(false);
    return useResumeStore.getState().summary;
  };

  const getMatchedJobs = async () => {
    const matchJob = await fetchMatchJob(sessionId);
    setMatchedJobs(matchJob);
    setMatchedJobsLoading(false);
  };

  const resetStateForAnalyze = () => {
    setSummaryLoading(true);
    setMatchedJobsLoading(true);
    setResumeUploaded(true);
    setSummary('');
    setCoverLetter('');
    setMatchedJobs([]);
    setAccordionOpen('');
    setSelectedJobId('');
    setSelectedJobName('');
  };

  const onSubmitPdf = async (values: z.infer<typeof pdfFormSchema>) => {
    resetStateForAnalyze();
    await getResumeSummaryPdf(values);
    await getMatchedJobs();
  };

  const onClickAccordion = (id: string) => {
    setAccordionOpen(accordianOpen === id ? '' : id);
  };

  const onClickTag = (event: React.MouseEvent<HTMLButtonElement>, _: string) => {
    event.stopPropagation();
  };

  const onClickJobSelectItem = (jobId: string) => {
    setSelectedJobId(jobId);
    for (const job of matchedJobs) {
      if (job.id === jobId) {
        setSelectedJobName(job.job_title + ' @ ' + job.company_name);
        break;
      }
    }
  };

  const onClickGenerateCoverLetter = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setCoverLetterButtonClicked(true);
    if (selectedJobId === '') return;
    console.log('generate cover letter: ', selectedJobId);
    setCoverLetter('');
    setCoverLetterLoading(true);
    const reader = await fetchGenerateCoverLetter(selectedJobId, sessionId);
    const decoder = new TextDecoder('utf-8');

    if (!reader) return;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const parsed = JSON.parse(chunk.replace(/\n/g, '\\n'));
      const coverLetter = useResumeStore.getState().coverLetter;
      useResumeStore.setState({ coverLetter: coverLetter + parsed['chunk'] });
    }

    setCoverLetterLoading(false);
  };

  const onClickModeChange = () => {
    setPdfMode(!pdfMode);
    navigate('/match-text');
  };

  const onClickRecentWeek = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const onClickRecentDay = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-6">
      <div className="w-full max-w-3xl mx-auto">
        <Label className="mb-3 mt-2 font-bold">
          이력서 분석 {'>'} 공고 매칭 {'>'} AI커버레터
        </Label>
        <div className="flex w-full items-center gap-1 mb-2">
          <div className="w-full text-gray-500 text-sm">
            PDF 형식의 이력서나 텍스트 자기소개로 분석이 가능합니다.
          </div>
          <Button
            variant="outline"
            className="self-start cursor-pointer"
            disabled={matchedJobsLoading}
            onClick={onClickModeChange}
          >
            {matchedJobsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              '텍스트로 분석하기'
            )}
          </Button>
        </div>
        <Form {...pdfForm}>
          <form
            onSubmit={pdfForm.handleSubmit(onSubmitPdf)}
            className="flex w-full items-center gap-1"
          >
            <FormField
              control={pdfForm.control}
              name="resumePdf"
              render={({ field: { value, onChange, ...fieldProps } }) => (
                <FormItem className="w-full">
                  <FormControl>
                    <Input
                      {...fieldProps}
                      type="file"
                      accept="application/pdf"
                      onChange={event => onChange(event.target.files && event.target.files[0])}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="self-start cursor-pointer"
              disabled={matchedJobsLoading}
            >
              {matchedJobsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '분석 시작'}
            </Button>
          </form>
        </Form>
        {summary || summaryLoading ? (
          <div className="mt-4">
            <Label className="font-bold">이력서 요약</Label>
            <div className="mt-2 p-4 border rounded-md text-sm" style={{ whiteSpace: 'pre-wrap' }}>
              {(resumeUploaded ? animatedText : summary) || (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
            </div>
          </div>
        ) : null}
        {matchedJobs.length > 0 || matchedJobsLoading ? (
          <div>
            <div className="w-full max-w-3xl mt-4 mb-5">
              <Label className="font-bold mb-2">커버레터 생성</Label>
              <div className="flex items-center w-full max-w-3xl gap-2">
                <Select value={selectedJobId} onValueChange={onClickJobSelectItem}>
                  <SelectTrigger className="w-full truncate">
                    <SelectValue placeholder={matchedJobs.length > 0 ? '추천공고' : '로딩 중...'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {matchedJobs.map(job => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.job_title} @ {job.company_name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button
                  type="submit"
                  className="self-start"
                  disabled={matchedJobsLoading}
                  onClick={e => onClickGenerateCoverLetter(e)}
                >
                  {matchedJobsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    '커버레터 생성'
                  )}
                </Button>
              </div>
            </div>
            {coverLetter || coverLetterLoading ? (
              <div className="mt-4">
                <Label className="font-bold mb-2">이력서 기반 커버레터 | {selectedJobName}</Label>
                <div
                  className="mt-2 p-4 border rounded-md text-sm"
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {(coverLetterButtonClicked ? animatedCoverLetter : coverLetter) || (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                </div>
              </div>
            ) : null}
            <div className="mt-4">
              <Label className="font-bold">추천 채용공고 (적합도순)</Label>
              <Accordion
                type="single"
                collapsible
                className="w-full max-w-3xl mx-auto mb-5"
                value={accordianOpen}
                onValueChange={setAccordionOpen}
              >
                {matchedJobs.map((job, index) => (
                  <JobAccordionItem
                    key={job.id}
                    job={job}
                    index={index}
                    selectedCompanies={[]}
                    selectedTags={[]}
                    onClickAccordion={onClickAccordion}
                    onClickCompany={onClickTag}
                    onClickTag={onClickTag}
                    filterByRecentWeek={false}
                    filterByRecentDay={false}
                    onClickRecentWeek={onClickRecentWeek}
                    onClickRecentDay={onClickRecentDay}
                  />
                ))}
                {matchedJobsLoading ? <Loader2 className="mt-5 ml-4 w-4 h-4 animate-spin" /> : null}
              </Accordion>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default JobMatcher;
