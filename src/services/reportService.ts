import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserProfile, QuizResult, PortfolioEntry } from '../types';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const saveToPortfolio = async (
  userId: string,
  title: string,
  type: PortfolioEntry['type'],
  totalPointsAtTime: number,
  badgesEarned?: string[],
  leadershipStats?: PortfolioEntry['leadershipStats']
) => {
  try {
    const portfolioRef = collection(db, 'portfolios');
    await addDoc(portfolioRef, {
      userId,
      title,
      type,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
      totalPointsAtTime,
      badgesEarned,
      leadershipStats,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving to portfolio:", error);
  }
};

export const exportIndividualReport = async (
  studentData: UserProfile,
  quizHistory: QuizResult[]
) => {
  const doc = new jsPDF();
  
  // 1. Header & Branding
  doc.setFillColor(212, 175, 55); // Institutional Gold
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("STUDENT PROGRESS REPORT", 105, 20, { align: "center" });
  doc.setFontSize(12);
  doc.text("Good Samaritan - The Institution of Education", 105, 30, { align: "center" });

  // 2. Student Info Box
  doc.setTextColor(40);
  doc.setFontSize(14);
  doc.text(`Name: ${studentData.displayName}`, 20, 55);
  doc.text(`House: ${studentData.houseTeam || 'N/A'}`, 20, 65);
  doc.text(`Standard: ${studentData.standard || 'N/A'}`, 20, 75);
  doc.text(`Roll Number: ${studentData.rollNumber || 'N/A'}`, 20, 85);

  // 3. Achievement Cards Summary (Visual Icons)
  doc.text("Achievement Cards Earned:", 20, 100);
  const colors: Record<string, [number, number, number]> = { 
    "Pink": [255, 192, 203], 
    "Green": [144, 238, 144], 
    "Blue": [173, 216, 230], 
    "Yellow": [255, 255, 224],
    "White": [245, 245, 245]
  };
  
  const cardCounts = studentData.studentData?.cards || studentData.cards || {};
  let xPos = 20;
  const cardKeys = ["White", "Yellow", "Blue", "Green", "Pink"];
  
  cardKeys.forEach(color => {
    const count = (cardCounts as any)[color.toLowerCase()] || 0;
    doc.setFillColor(...(colors[color] || [200, 200, 200]));
    doc.rect(xPos, 105, 35, 15, 'F');
    doc.setTextColor(40);
    doc.setFontSize(10);
    doc.text(`${color}: ${count}`, xPos + 2, 115);
    xPos += 38;
  });

  // 4. Academic Quiz Table
  doc.setTextColor(40);
  doc.setFontSize(14);
  doc.text("Academic Performance:", 20, 135);

  autoTable(doc, {
    startY: 140,
    head: [['Date', 'Quiz Title', 'Subject', 'Score', 'Status']],
    body: quizHistory.map(q => [
      q.timestamp?.toDate ? q.timestamp.toDate().toLocaleDateString() : new Date(q.timestamp).toLocaleDateString(),
      q.quizTitle,
      q.subject,
      `${Math.round((q.score / q.totalScore) * 100)}%`,
      q.status
    ]),
    theme: 'grid',
    headStyles: { fillColor: [50, 50, 50] }
  });

  // 5. Final Calculation
  const totalPoints = studentData.studentData?.points ?? studentData.totalPoints ?? 0;
  const finalY = (doc as any).lastAutoTable.finalY || 150;
  doc.setFontSize(14);
  doc.text(`Cumulative Points: ${totalPoints}`, 20, finalY + 20);

  // Footer
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 285, { align: "center" });

  doc.save(`${studentData.displayName}_Progress_Report.pdf`);
};
