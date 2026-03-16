import { jsPDF } from "jspdf";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "../firebase";
import { UserProfile } from "../types";

export async function generateAndAwardLeaderCertificate(leader: UserProfile) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const month = new Date().toLocaleString('default', { month: 'long' });
  const year = new Date().getFullYear();
  const certId = `CERT-${leader.uid.substring(0, 5)}-${Date.now().toString().substring(7)}`;

  // 1. Gold Decorative Border
  doc.setLineWidth(2);
  doc.setDrawColor(212, 175, 55); // Gold color
  doc.rect(10, 10, 277, 190); 
  
  // Inner border
  doc.setLineWidth(0.5);
  doc.rect(13, 13, 271, 184);

  // 2. School Header
  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.setTextColor(26, 41, 66); // Dark blue
  doc.text("GOOD SAMARITAN - THE INSTITUTION OF EDUCATION", 148, 40, { align: "center" });

  // 3. Certificate Title
  doc.setFontSize(32);
  doc.setTextColor(184, 134, 11); // Darker Gold
  doc.text("CERTIFICATE OF EXCELLENCE", 148, 70, { align: "center" });

  // 4. Content
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.setFont("times", "normal");
  doc.text("This is to certify that", 148, 95, { align: "center" });

  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 41, 66);
  doc.text(leader.displayName.toUpperCase(), 148, 115, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("times", "normal");
  doc.setTextColor(80, 80, 80);
  const formatHouseName = (house?: string) => {
    if (!house) return 'Good Samaritan';
    return house.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  };

  doc.text(`Has demonstrated outstanding leadership as a Leader of the ${formatHouseName(leader.houseTeam)} House`, 148, 135, { align: "center" });
  doc.text(`during the month of ${month} ${year}.`, 148, 145, { align: "center" });

  // 5. Citation
  doc.setFontSize(12);
  doc.setFont("times", "italic");
  doc.text("This certificate is awarded for exceptional leadership and dedicated service to the student community.", 148, 160, { align: "center" });

  // 6. Signatures
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  
  doc.line(40, 180, 100, 180);
  doc.text("Academic Dean", 70, 188, { align: "center" });

  doc.line(190, 180, 250, 180);
  doc.text("School Principal", 220, 188, { align: "center" });

  // 7. Certificate ID & Security
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Certificate ID: ${certId}`, 15, 195);
  doc.text(`Verified Digital Signature: GS-AUTH-${leader.uid.substring(0, 8)}`, 282, 195, { align: "right" });

  // 8. Convert to Blob and Upload
  const pdfBlob = doc.output('blob');
  const fileName = `certificates/${leader.uid}/Leader_Award_${month}_${year}.pdf`;
  const storageRef = ref(storage, fileName);
  
  await uploadBytes(storageRef, pdfBlob);
  const downloadUrl = await getDownloadURL(storageRef);

  // 9. Add to Portfolio
  await addDoc(collection(db, 'portfolios'), {
    userId: leader.uid,
    title: `Certificate of Excellence - ${month} ${year}`,
    type: 'Leadership Milestone',
    date: new Date().toISOString().split('T')[0],
    downloadUrl: downloadUrl,
    totalPointsAtTime: leader.totalPoints || 0,
    timestamp: serverTimestamp()
  });

  // 10. Send Notification
  await addDoc(collection(db, 'notifications'), {
    userId: leader.uid,
    title: "🏆 Excellence Award Earned!",
    message: `Congratulations! You've been awarded a Certificate of Excellence for your leadership in ${month}. Check your Achievement Vault!`,
    type: 'Reward',
    link: 'Achievement Vault',
    read: false,
    createdAt: serverTimestamp()
  });

  return downloadUrl;
}
