/** A short original PCM tone; never autoplays. */
function exampleSound(): File {
  const samples = 2000,
    bytes = new ArrayBuffer(44 + samples * 2),
    view = new DataView(bytes);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++)
    view.setInt16(44 + i * 2, Math.sin((i / 8000) * 440 * 2 * Math.PI) * 2500, true);
  return new File([bytes], 'sound-example.wav', { type: 'audio/wav' });
}
/** Original, non-personal examples. No network, third-party assets or active documents. */
export function examplePdf(): File {
  const content =
    'BT /F1 24 Tf 60 740 Td (FOCUS / PROJECT NOTE) Tj /F1 12 Tf 0 -45 Td (1. Define one clear result.) Tj 0 -24 Td (2. Split the work into small steps.) Tj 0 -24 Td (3. Choose a date and start.) Tj 0 -55 Td (This is a generated demo file. No personal data.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n')
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new File([pdf], 'focus-project-note.pdf', { type: 'application/pdf' });
}
export async function exampleFiles(): Promise<{ plan: File[]; idea: File[]; personal: File[] }> {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 640;
  const context = canvas.getContext('2d');
  if (!context) throw Error('Не удалось подготовить пример изображения.');
  context.fillStyle = '#f4f2eb';
  context.fillRect(0, 0, 1000, 640);
  context.fillStyle = '#3157ce';
  context.fillRect(70, 65, 10, 500);
  context.beginPath();
  context.arc(830, 175, 85, 0, 2 * Math.PI);
  context.fill();
  context.fillStyle = '#252c37';
  context.font = '56px Georgia';
  context.fillText('A little room', 125, 210);
  context.fillText('for what matters.', 125, 285);
  context.font = '22px sans-serif';
  context.fillText('FOCUS / GENERATED DEMO / NO PERSONAL DATA', 125, 465);
  const image = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(Error('Не удалось подготовить изображение.'))),
      'image/png',
    ),
  );
  return {
    plan: [
      examplePdf(),
      new File(
        [
          'ПЛАН ПРОЕКТА\n\nЭто безопасный пример, созданный специально для FOCUS.\n\nРезультат: понятный план небольшой задачи.\n1. Сформулировать результат.\n2. Выделить три этапа.\n3. Начать с первого шага.\n\nМожно изменить текст, скачать файл или удалить его.\n',
        ],
        'plan-example.txt',
        { type: 'text/plain' },
      ),
    ],
    idea: [
      new File(['Этап,Статус\nПодготовка,Готово\nПроверка,В работе\n'], 'plan-example.csv', {
        type: 'text/csv',
      }),
      new File(
        [
          JSON.stringify(
            {
              example: true,
              title: 'Идея для проекта',
              steps: ['Записать мысль', 'Выбрать следующий шаг'],
              personalData: false,
            },
            null,
            2,
          ),
        ],
        'idea-example.json',
        { type: 'application/json' },
      ),
    ],
    personal: [new File([image], 'focus-example.png', { type: 'image/png' }), exampleSound()],
  };
}
