import { useRef, useState } from 'react'
import './App.css'
import { generateReport, submitReport } from './api'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const MAX_POC_SIZE = 10 * 1024 * 1024
const CATEGORIES = ['Community service', 'Cleanliness', 'Environment', 'Awareness', 'Other']

const emptyReport = {
  collegeName: '',
  collegeAddress: '',
  collegeStatus: '',
  title: 'A Report on Social Service Activities',
  degree: 'Bachelor of Technology',
  branch: '',
  studentName: '',
  rollNumber: '',
  academicBatch: '',
  preparedBy: '',
  department: '',
  period: '',
  description: '',
  collegeLogo: null,
  collegeHeader: null,
}

function makeActivity(files) {
  const photos = Array.from(files)
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file: photos[0],
    preview: URL.createObjectURL(photos[0]),
    files: photos,
    previews: photos.map((file) => URL.createObjectURL(file)),
    title: '',
    description: '',
    date: '',
    location: '',
    category: 'Community service',
    socialHours: '',
    participationLevel: '',
    status: 'idle',
    error: '',
    pocImage: null,
    pocImages: [],
    pocPreviews: [],
    pocReference: '',
  }
}

async function validateImageContent(file) {
  try {
    const bitmap = await createImageBitmap(file)
    bitmap.close()
    return true
  } catch {
    return false
  }
}

function App() {
  const [activities, setActivities] = useState([])
  const [report, setReport] = useState(emptyReport)
  const [activeSection, setActiveSection] = useState('workspace')
  const [toast, setToast] = useState(null)
  const [finalized, setFinalized] = useState(false)
  const [exportingFormat, setExportingFormat] = useState(null)
  const inputRef = useRef(null)

  const completedPoc = activities.filter((activity) => activity.pocImage || activity.pocImages?.length).length
  const pocPercent = activities.length ? Math.round((completedPoc / activities.length) * 100) : 0
  const missingPoc = activities.filter((activity) => !(activity.pocImage || activity.pocImages?.length))
  const generatedCount = activities.filter((activity) => activity.description).length

  const updateActivity = (id, changes) => {
    setActivities((current) => current.map((activity) => (
      activity.id === id ? { ...activity, ...changes } : activity
    )))
    setFinalized(false)
  }

  const removePoc = (id, pocIndex) => {
    setActivities((current) => current.map((activity) => {
      if (activity.id !== id) return activity
      const files = activity.pocImages || (activity.pocImage ? [activity.pocImage] : [])
      const previews = activity.pocPreviews || (activity.pocPreview ? [activity.pocPreview] : [])
      URL.revokeObjectURL(previews[pocIndex])
      const remainingFiles = files.filter((_, index) => index !== pocIndex)
      const remainingPreviews = previews.filter((_, index) => index !== pocIndex)
      return {
        ...activity,
        pocImage: remainingFiles[0] || null,
        pocImages: remainingFiles,
        pocPreviews: remainingPreviews,
        pocPreview: remainingPreviews[0] || null,
      }
    }))
    setFinalized(false)
  }

  const removeActivity = (id) => {
    setActivities((current) => {
      const activity = current.find((item) => item.id === id)
      if (activity) {
        URL.revokeObjectURL(activity.preview)
        ;(activity.previews || []).forEach((preview) => URL.revokeObjectURL(preview))
        ;(activity.pocPreviews || []).forEach((preview) => URL.revokeObjectURL(preview))
      }
      return current.filter((item) => item.id !== id)
    })
    setFinalized(false)
  }

  const moveActivity = (id, direction) => {
    setActivities((current) => {
      const index = current.findIndex((activity) => activity.id === id)
      const targetIndex = index + direction
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current
      const next = [...current]
      const moved = next[index]
      next[index] = next[targetIndex]
      next[targetIndex] = moved
      return next
    })
    setFinalized(false)
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 4200)
  }

  const addImages = async (files) => {
    const accepted = []
    const errors = []
    for (const file of Array.from(files)) {
      if (!IMAGE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: use JPG, PNG or WEBP.`)
      } else if (file.size > MAX_IMAGE_SIZE) {
        errors.push(`${file.name}: must be smaller than 8 MB.`)
      } else if (!await validateImageContent(file)) {
        errors.push(`${file.name}: the file content is not a readable image.`)
      } else {
        accepted.push(makeActivity([file]))
      }
    }
    if (accepted.length) {
      setActivities((current) => [...current, ...accepted])
    }
    if (errors.length) showToast(errors.join(' '), 'error')
    if (accepted.length) setActiveSection('workspace')
  }

  const handleImageInput = (event) => {
    addImages(event.target.files)
    event.target.value = ''
  }

  const addActivityPhotos = async (id, files) => {
    const accepted = []
    const errors = []
    for (const file of Array.from(files || [])) {
      if (!IMAGE_TYPES.includes(file.type)) errors.push(`${file.name}: use JPG, PNG or WEBP.`)
      else if (file.size > MAX_IMAGE_SIZE) errors.push(`${file.name}: must be smaller than 8 MB.`)
      else if (!await validateImageContent(file)) errors.push(`${file.name}: the file content is not a readable image.`)
      else accepted.push(file)
    }
    if (accepted.length) {
      setActivities((current) => current.map((activity) => activity.id === id
        ? { ...activity, files: [...(activity.files || [activity.file]), ...accepted], previews: [...(activity.previews || [activity.preview]), ...accepted.map((file) => URL.createObjectURL(file))] }
        : activity))
      setFinalized(false)
    }
    if (errors.length) showToast(errors.join(' '), 'error')
  }

  const removeActivityPhoto = (id, photoIndex) => {
    setActivities((current) => current.map((activity) => {
      if (activity.id !== id) return activity
      const files = activity.files || [activity.file]
      const previews = activity.previews || [activity.preview]
      if (files.length === 1) return activity
      URL.revokeObjectURL(previews[photoIndex])
      return { ...activity, files: files.filter((_, index) => index !== photoIndex), previews: previews.filter((_, index) => index !== photoIndex) }
    }))
    setFinalized(false)
  }

  const attachPoc = async (id, files) => {
    const accepted = []
    const errors = []
    for (const file of Array.from(files || [])) {
      if (!IMAGE_TYPES.includes(file.type)) errors.push(`${file.name}: use JPG, PNG or WEBP.`)
      else if (file.size > MAX_POC_SIZE) errors.push(`${file.name}: must be smaller than 10 MB.`)
      else if (!await validateImageContent(file)) errors.push(`${file.name}: the file content is not a readable image.`)
      else accepted.push(file)
    }
    if (errors.length) showToast(errors.join(' '), 'error')
    if (!accepted.length) return
    setActivities((current) => current.map((activity) => {
      if (activity.id !== id) return activity
      const oldFiles = activity.pocImages || (activity.pocImage ? [activity.pocImage] : [])
      const oldPreviews = activity.pocPreviews || (activity.pocPreview ? [activity.pocPreview] : [])
      return { ...activity, pocImage: oldFiles[0] || accepted[0], pocImages: [...oldFiles, ...accepted], pocPreviews: [...oldPreviews, ...accepted.map((file) => URL.createObjectURL(file))] }
    }))
    setFinalized(false)
  }

  const finalizeReport = () => {
    if (missingPoc.length) {
      setActiveSection('review')
      showToast(`Add POC letters for: ${missingPoc.map((activity) => activity.title || 'Untitled activity').join(', ')}`, 'error')
      return
    }
    if (!activities.length) {
      showToast('Add an activity before finalizing the report.', 'error')
      return
    }
    setFinalized(true)
    showToast('Report is ready for submission.')
  }

  const toDataUrl = async (file) => {
    if (!(file instanceof Blob)) throw new Error('The selected image is no longer available. Please select it again.')
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      let binary = ''
      const chunkSize = 0x8000
      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
      }
      return `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`
    } catch (error) {
      throw new Error(`Unable to read ${file.name || 'the selected image'}.`, { cause: error })
    }
  }

  const buildReportPayload = async () => ({
    ...report,
    collegeLogo: report.collegeLogo ? await toDataUrl(report.collegeLogo) : null,
    collegeHeader: report.collegeHeader ? await toDataUrl(report.collegeHeader) : null,
    activities: await Promise.all(activities.map(async (activity) => ({
      id: activity.id,
      title: activity.title,
      description: activity.description,
      date: activity.date,
      location: activity.location,
      category: activity.category,
      socialHours: activity.socialHours,
      participationLevel: activity.participationLevel,
      pocReference: activity.pocReference,
      photo: await toDataUrl((activity.files || [activity.file])[0]),
      photos: await Promise.all((activity.files || [activity.file]).map(toDataUrl)),
      pocImage: await toDataUrl((activity.pocImages || [activity.pocImage])[0]),
      pocImages: await Promise.all((activity.pocImages || [activity.pocImage]).map(toDataUrl)),
    }))),
  })

  const exportReport = async (format) => {
    if (exportingFormat) return
    setExportingFormat(format)
    try {
      const payload = await buildReportPayload()
      const { blob, filename } = await generateReport(payload, format)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      window.setTimeout(() => {
        URL.revokeObjectURL(url)
        link.remove()
      }, 1000)
      showToast(`${format.toUpperCase()} report downloaded.`)
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setExportingFormat(null)
    }
  }

  const submitFinalReport = async () => {
    if (missingPoc.length) return finalizeReport()
    try {
      await submitReport(await buildReportPayload())
      setFinalized(true)
      showToast('Report finalized for this session.')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  const sectionTitle = activeSection === 'review' ? 'Review & finalize' : activeSection === 'report' ? 'Report information' : 'Activity workspace'
  const sectionDescription = activeSection === 'review'
    ? 'Confirm every activity and its Proof of Completion before finalizing.'
    : activeSection === 'report'
      ? 'Add the context that will appear on your final report.'
      : 'Turn activity photographs into a complete, reviewable report.'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">SA</div>
          <div><strong>Smart Activity</strong><span>Report Generator</span></div>
        </div>
        <div className="sidebar-label">Workspace</div>
        <nav>
          <button className={activeSection === 'workspace' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('workspace')}><span>▦</span> Activities <b>{activities.length}</b></button>
          <button className={activeSection === 'report' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('report')}><span>▤</span> Report information</button>
          <button className={activeSection === 'review' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('review')}><span>✓</span> Review & finalize</button>
        </nav>
        <div className="sidebar-bottom">
            <div className="poc-mini">
            <div className="mini-heading"><span>POC completion</span><strong>{pocPercent}%</strong></div>
            <div className="progress-track"><div style={{ width: `${pocPercent}%` }} /></div>
            <small>{completedPoc} of {activities.length} letters submitted</small>
          </div>
          <div className="privacy-note"><span>⌁</span><div><strong>Private by design</strong><small>Files remain in this session only.</small></div></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark">SA</div><strong>Smart Activity</strong></div>
          <div className="topbar-actions"><span className="draft-pill"><i /> Draft report</span><button className="icon-button" aria-label="Help">?</button><div className="avatar">AM</div></div>
        </header>
        <div className="content-wrap">
          <div className="page-heading">
            <div><div className="eyebrow">REPORT BUILDER / 01</div><h1>{sectionTitle}</h1><p>{sectionDescription}</p></div>
            {activeSection === 'workspace' && <button className="primary-button" onClick={() => inputRef.current?.click()}><span>＋</span> Add photographs</button>}
          </div>

          {activeSection === 'workspace' && (
            <>
              <section className="metrics-row">
                <div className="metric-card"><div className="metric-icon purple">▦</div><div><small>Activities</small><strong>{activities.length}</strong></div><span className="metric-note">uploaded</span></div>
                <div className="metric-card"><div className="metric-icon green">✎</div><div><small>Descriptions</small><strong>{generatedCount}<em> / {activities.length}</em></strong></div><span className="metric-note">entered manually</span></div>
                <div className="metric-card"><div className="metric-icon orange">✓</div><div><small>POC letters</small><strong>{completedPoc}<em> / {activities.length}</em></strong></div><span className="metric-note">{pocPercent}% complete</span></div>
              </section>
              <section className="upload-zone" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addImages(event.dataTransfer.files) }}>
                <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple onChange={handleImageInput} />
                <div className="upload-icon">↑</div><div><strong>Drop your activity photographs here</strong><p>or <u>browse files</u> from your computer</p></div><span className="upload-hint">JPG, PNG or WEBP · max 8 MB each</span>
              </section>
              <div className="section-toolbar"><div><h2>Activity details <span>{activities.length}</span></h2><p>Enter a clear title and description for each photograph, then attach its POC evidence.</p></div></div>
              {!activities.length ? <EmptyState onUpload={() => inputRef.current?.click()} /> : <div className="activity-list">{activities.map((activity, index) => <ActivityCard key={activity.id} activity={activity} index={index} count={activities.length} onChange={updateActivity} onRemove={removeActivity} onMove={moveActivity} onPoc={attachPoc} onRemovePoc={removePoc} onPhotos={addActivityPhotos} onRemovePhoto={removeActivityPhoto} />)}</div>}
            </>
          )}

          {activeSection === 'report' && <ReportForm report={report} setReport={setReport} onContinue={() => setActiveSection('review')} />}
          {activeSection === 'review' && <Review activities={activities} report={report} missingPoc={missingPoc} pocPercent={pocPercent} finalized={finalized} exportingFormat={exportingFormat} onFinalize={submitFinalReport} onExport={exportReport} onGoActivities={() => setActiveSection('workspace')} />}
        </div>
      </main>
      {toast && <div className={`toast ${toast.type}`}><span>{toast.type === 'error' ? '!' : '✓'}</span>{toast.message}</div>}
    </div>
  )
}

function EmptyState({ onUpload }) {
  return <div className="empty-state"><div className="empty-art">✦</div><h3>No activities yet</h3><p>Upload photographs to start building your activity report.</p><button className="secondary-button" onClick={onUpload}>Upload first photograph</button></div>
}

function ActivityCard({ activity, index, count, onChange, onRemove, onMove, onPoc, onRemovePoc, onPhotos, onRemovePhoto }) {
  const pocInput = useRef(null)
  const photoInput = useRef(null)
  const [confirming, setConfirming] = useState(false)
  const set = (field) => (event) => onChange(activity.id, { [field]: event.target.value })
  return (
    <article className="activity-card">
      <div className="card-topline"><span className="activity-number">ACTIVITY {String(index + 1).padStart(2, '0')}</span><div className="card-actions"><button className="text-button" onClick={() => onMove(activity.id, -1)} disabled={index === 0}>Move up</button><button className="text-button" onClick={() => onMove(activity.id, 1)} disabled={index === count - 1}>Move down</button><button className="remove-button" onClick={() => setConfirming(true)}>Remove</button></div></div>
      <div className="card-grid">
        <div className="photo-column"><div className="photo-gallery">{(activity.previews || [activity.preview]).map((preview, photoIndex) => <div className="photo-thumb" key={preview}><img src={preview} alt={`${activity.title || `Activity ${index + 1}`} photograph ${photoIndex + 1}`} />{(activity.files || [activity.file]).length > 1 && <button type="button" className="thumb-remove" aria-label={`Remove photograph ${photoIndex + 1}`} onClick={() => onRemovePhoto(activity.id, photoIndex)}>×</button>}</div>)}</div><button type="button" className="add-photo-button" onClick={() => photoInput.current?.click()}>＋ Add photographs</button><input ref={photoInput} hidden type="file" multiple accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => { onPhotos(activity.id, event.target.files); event.target.value = '' }} /><div className="photo-count">{(activity.files || [activity.file]).length} photograph{(activity.files || [activity.file]).length === 1 ? '' : 's'}</div></div>
        <div className="details-column">
          <label>Activity title<input value={activity.title} onChange={set('title')} placeholder="e.g. Community cleanliness drive" /></label>
          <label>Activity description<textarea value={activity.description} onChange={set('description')} placeholder="Describe the activity in 2–3 professional sentences..." rows="4" /></label>
          {activity.error && <div className="inline-error">! {activity.error}</div>}
          <div className="field-row"><label>Date<input type="date" value={activity.date} onChange={set('date')} /></label><label>Location<input value={activity.location} onChange={set('location')} placeholder="City / venue" /></label></div>
          <label>Category<select value={activity.category} onChange={set('category')}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Social service hours<input type="number" min="0" step="0.5" value={activity.socialHours} onChange={set('socialHours')} placeholder="Hours" /></label>
          <label>Level of participation<input value={activity.participationLevel} onChange={set('participationLevel')} placeholder="Participant / volunteer" /></label>
          <div className="card-footer-actions"><span className="editable-note">All fields are editable and entered manually</span></div>
        </div>
      </div>
      <div className="poc-panel">
        <div className="poc-heading"><div className="poc-icon">▤</div><div><strong>POC documentary evidence <span className="required">Required</span></strong><small>Attach front, back, or multiple evidence pages for this activity.</small></div><span className={`poc-status ${(activity.pocImage || activity.pocImages?.length) ? 'submitted' : 'pending'}`}>{(activity.pocImages || []).length || (activity.pocImage ? 1 : 0)} uploaded</span></div>
        <div className="poc-content"><div className="poc-gallery">{(activity.pocPreviews || (activity.pocPreview ? [activity.pocPreview] : [])).map((preview, pocIndex) => <div className="poc-thumb" key={preview}><img className="poc-preview" src={preview} alt={`POC evidence ${pocIndex + 1}`} /><button type="button" className="thumb-remove" aria-label={`Remove POC image ${pocIndex + 1}`} onClick={() => onRemovePoc(activity.id, pocIndex)}>×</button></div>)}<button type="button" className="poc-upload" onClick={() => pocInput.current?.click()}><span>↑</span><div><strong>{(activity.pocImages || []).length ? 'Add POC images' : 'Upload POC images'}</strong><small>JPG, PNG or WEBP · max 10 MB each</small></div></button></div><input ref={pocInput} hidden type="file" multiple accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => { onPoc(activity.id, event.target.files); event.target.value = '' }} /><label className="reference-field">POC reference / remarks<input value={activity.pocReference} onChange={set('pocReference')} placeholder="Optional reference number or note" /></label></div>
      </div>
      {confirming && <div className="confirm-row"><span>Remove this activity and its POC letter?</span><button className="remove-button" onClick={() => onRemove(activity.id)}>Yes, remove</button><button className="text-button" onClick={() => setConfirming(false)}>Cancel</button></div>}
    </article>
  )
}

function ReportForm({ report, setReport, onContinue }) {
  const set = (field) => (event) => setReport((current) => ({ ...current, [field]: event.target.value }))
  const setLogo = (event) => setReport((current) => ({ ...current, collegeLogo: event.target.files[0] || null }))
  const setHeader = (event) => setReport((current) => ({ ...current, collegeHeader: event.target.files[0] || null }))
  return <section className="form-panel"><div className="form-intro"><div className="large-icon">▤</div><div><h2>Report details</h2><p>These details are used on the formal academic cover page and generated reports.</p></div></div><div className="form-grid"><label>College name<input value={report.collegeName} onChange={set('collegeName')} placeholder="Enter college name" /></label><label>Report title<input value={report.title} onChange={set('title')} placeholder="A Report on Social Service Activities" /></label><label>College address<input value={report.collegeAddress} onChange={set('collegeAddress')} placeholder="Full college address" /></label><label>College status<input value={report.collegeStatus} onChange={set('collegeStatus')} placeholder="Autonomous / affiliated" /></label><label>Degree<input value={report.degree} onChange={set('degree')} placeholder="Bachelor of Technology" /></label><label>Branch / Department<input value={report.branch} onChange={set('branch')} placeholder="Computer Science and Engineering" /></label><label>Student name<input value={report.studentName} onChange={set('studentName')} placeholder="Student name" /></label><label>Roll number<input value={report.rollNumber} onChange={set('rollNumber')} placeholder="Roll number" /></label><label>Academic batch / year<input value={report.academicBatch} onChange={set('academicBatch')} placeholder="2022 - 2026" /></label><label>Prepared by<input value={report.preparedBy} onChange={set('preparedBy')} placeholder="Name of report preparer" /></label><label>Reporting period<input value={report.period} onChange={set('period')} placeholder="January - March 2026" /></label><label>College logo<input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={setLogo} /></label><label>Complete college header image<input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={setHeader} /><small className="field-help">Upload the supplied header image to place it at the top of the cover page.</small></label><label className="full">Overall report description<textarea value={report.description} onChange={set('description')} rows="5" placeholder="Summarize the purpose and outcomes of these activities..." /></label></div><div className="form-actions"><button className="primary-button" onClick={onContinue}>Continue to review <span>→</span></button></div></section>
}

function Review({ activities, report, missingPoc, pocPercent, finalized, exportingFormat, onFinalize, onExport, onGoActivities }) {
  return <div className="review-layout"><section className="review-main"><div className="review-summary"><div className="review-summary-icon">✓</div><div><small>REPORT OVERVIEW</small><h2>{report.title || 'Untitled report'}</h2><p>{report.collegeName || 'College not specified'} {report.period && ` · ${report.period}`}</p></div></div><div className="review-heading"><div><h2>Activity checklist</h2><p>{activities.length} activities included in this report.</p></div><button className="text-button" onClick={onGoActivities}>← Edit activities</button></div>{activities.length ? <div className="review-list">{activities.map((activity, index) => <div className="review-item" key={activity.id}><img src={activity.preview} alt="" /><div className="review-item-text"><span>ACTIVITY {String(index + 1).padStart(2, '0')}</span><h3>{activity.title || 'Untitled activity'}</h3><p>{activity.description || 'No description added yet.'}</p><small>{activity.date || 'No date'} {activity.location && ` · ${activity.location}`}</small></div><div className={`review-poc ${activity.pocImage ? 'submitted' : 'missing'}`}>{activity.pocImage ? '✓ POC submitted' : '! POC required'}</div></div>)}</div> : <EmptyState onUpload={onGoActivities} />}</section><aside className="review-side"><div className={`completion-card ${missingPoc.length ? 'warning' : 'complete'}`}><div className="completion-ring" style={{ '--percent': `${pocPercent * 3.6}deg` }}><strong>{pocPercent}%</strong></div><h3>{missingPoc.length ? 'POC images pending' : 'All POC images submitted'}</h3><p>{missingPoc.length ? `${missingPoc.length} ${missingPoc.length === 1 ? 'activity needs' : 'activities need'} a POC image before you can finalize.` : 'Every activity has documentary evidence.'}</p>{missingPoc.length > 0 && <ul>{missingPoc.map((activity) => <li key={activity.id}>{activity.title || 'Untitled activity'}</li>)}</ul>}</div><button className="finalize-button" onClick={onFinalize} disabled={!activities.length || missingPoc.length > 0}>{finalized ? '✓ Report submitted' : 'Submit report'}</button><div className="export-card"><div className="export-heading"><div><h3>Export report</h3><p>Download a polished copy with the cover page, index and activity pages.</p></div><span className="export-status">READY</span></div><div className="export-actions"><button className="export-button export-docx" disabled={Boolean(exportingFormat)} onClick={() => onExport('docx')}><span className="format-icon">W</span><span className="export-label"><strong>{exportingFormat === 'docx' ? 'Generating Word report...' : 'Download Word report'}</strong><small>Editable document · .docx</small></span><span className="download-icon" aria-hidden="true">{exportingFormat === 'docx' ? '...' : '↓'}</span></button><button className="export-button export-pdf" disabled={Boolean(exportingFormat)} onClick={() => onExport('pdf')}><span className="format-icon">P</span><span className="export-label"><strong>{exportingFormat === 'pdf' ? 'Generating PDF report...' : 'Download PDF report'}</strong><small>Print-ready document · .pdf</small></span><span className="download-icon" aria-hidden="true">{exportingFormat === 'pdf' ? '...' : '↓'}</span></button><button className="export-button export-pptx" disabled={Boolean(exportingFormat)} onClick={() => onExport('pptx')}><span className="format-icon">P</span><span className="export-label"><strong>{exportingFormat === 'pptx' ? 'Generating PowerPoint...' : 'Download PowerPoint'}</strong><small>Presentation slides · .pptx</small></span><span className="download-icon" aria-hidden="true">{exportingFormat === 'pptx' ? '...' : '↓'}</span></button></div></div></aside></div>
}

export default App
