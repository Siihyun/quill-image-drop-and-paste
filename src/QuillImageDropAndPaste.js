import utils from './utils'

class ImageData {

	constructor(dataUrl, type) {
		this.dataUrl = dataUrl
		this.type = type
	}

	/* minify the image
	*/
	minify(options = {}) {
		return new Promise((resolve, reject) => {
			const maxWidth = options.maxWidth || 800
			const maxHeight = options.maxHeight || 800
			const quality = options.quality || .8
			if (!this.dataUrl) {
				return reject({ message: '[error] QuillImageDropAndPaste: Fail to minify the image, dataUrl should not be empty.' })
			}
			const image = new Image()
			image.onload = () => {
				const width = image.width
				const height = image.height
				if (width > height) {
					if (width > maxWidth) {
						image.height = height * maxWidth / width
						image.width = maxWidth
					}
				} else {
					if (height > maxHeight) {
						image.width = width * maxHeight / height
						image.height = maxHeight
					}
				}
				const canvas = document.createElement('canvas')
				canvas.width = image.width
				canvas.height = image.height
				var ctx = canvas.getContext('2d')
				ctx.drawImage(image, 0, 0, image.width, image.height)
				const canvasType = this.type || 'image/png'
				const canvasDataUrl = canvas.toDataURL(canvasType, quality)
				resolve(new ImageData(canvasDataUrl, canvasType))
			}
			image.src = this.dataUrl
		})
		
	}

	/* convert blob to file
	*/
	toFile(filename) {
		if (!window.File) {
			console.error('[error] QuillImageDropAndPaste: Your browser didnot support File API.')
			return null
		}
		return new File([this.toBlob()], filename, { type: this.type })
	}

	/* convert dataURL to blob
	*/
	toBlob() {
		const base64 = this.dataUrl.replace(/^[^,]+,/, '')
		const buff = this.binaryStringToArrayBuffer(atob(base64))
		return this.createBlob([buff], { type: this.type })
	}

	/* generate array buffer from binary string
	*/
	binaryStringToArrayBuffer(binary) {
		const len = binary.length
		const buffer = new ArrayBuffer(len)
		const arr = new Uint8Array(buffer)
		let i = -1
		while (++i < len) arr[i] = binary.charCodeAt(i)
		return buffer
	}

	/* create blob
	*/
	createBlob(parts = [], properties = {}) {
		if (typeof properties === 'string') properties = { type: properties }
		try {
			return new Blob(parts, properties)
		} catch(e) {
			if (e.name !== 'TypeError') throw e
			const Builder = typeof BlobBuilder !== 'undefined'
				? BlobBuilder : typeof MSBlobBuilder !== 'undefined'
				? MSBlobBuilder : typeof MozBlobBuilder !== 'undefined'
				? MozBlobBuilder : WebKitBlobBuilder
			const builder = new Builder()
			for (let i = 0; i < parts.length; i++) builder.append(parts[i])
			return builder.getBlob(properties.type)
		}
	}
}

class ImageDropAndPaste {

	constructor(quill, options = {}) {
		this.quill = quill
		this.options = options
		this.handleDrop = this.handleDrop.bind(this)
		this.handlePaste = this.handlePaste.bind(this)
		this.insert = this.insert.bind(this)
		this.quill.root.addEventListener('drop', this.handleDrop, false)
		this.quill.root.addEventListener('paste', this.handlePaste, false)
	}

	/* handle image drop event
	*/
	handleDrop (e) {
		e.preventDefault()
		if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
			if (document.caretRangeFromPoint) {
				const selection = document.getSelection()
				const range = document.caretRangeFromPoint(e.clientX, e.clientY)
				if (selection && range) {
					selection.setBaseAndExtent(range.startContainer, range.startOffset, range.startContainer, range.startOffset)
				}
			}
			this.readFiles(e.dataTransfer.files, (dataUrl, type) => {
				type = type || 'image/png'
				if (typeof this.options.handler === 'function') {
					this.options.handler.call(this, dataUrl, type, new ImageData(dataUrl, type))
				} else {
					this.insert.call(this, dataUrl, type)
				}
			}, e)
		}
	}

	/* handle image paste event
	*/
	handlePaste (e) {
		if (e.clipboardData && e.clipboardData.items && e.clipboardData.items.length) {
			if (utils.isHtmlText(e.clipboardData.items)) return
			this.readFiles(e.clipboardData.items, (dataUrl, type) => {
				type = type || 'image/png'
				if (typeof this.options.handler === 'function') {
					this.options.handler.call(this, dataUrl, type, new ImageData(dataUrl, type))
				} else {
					this.insert(dataUrl, 'image')
				}
			}, e)
		}
	}

	/* read the files
	*/
	readFiles (files, callback, e) {
		e.preventDefault()
		const that = this
		Array.prototype.forEach.call(files, file => {
			const type = file.type
			if (type.match(/^image\/(gif|jpe?g|a?png|svg|webp|bmp)/i)) {
				const reader = new FileReader()
				reader.onload = (e) => {
					callback(e.target.result, type)
				}
				const blob = file.getAsFile ? file.getAsFile() : file
				if (blob instanceof Blob) reader.readAsDataURL(blob)
			} else if(type.match(/^text\/plain$/i)) {
				file.getAsString((s) => {
					utils.urlIsImage(s).then(() => {
						that.insert(s, 'image')
					}).catch(() => {
						that.insert(s, 'text')
					})
				})
			}
		})
	}

	/* insert into the editor
	*/
	insert (content, type) {
		let index = (this.quill.getSelection(true) || {}).index
		if (index === undefined || index < 0) index = this.quill.getLength()
		if (type === 'image') {
			this.quill.insertEmbed(index, type, content, 'user')
			this.quill.setSelection(index + 1)
		} else if (type === 'text') {
			this.quill.insertText(index, content, 'user')
		}
	}
}

ImageDropAndPaste.ImageData = ImageData

window.QuillImageDropAndPaste = ImageDropAndPaste
if ('Quill' in window) {
	window.Quill.register('modules/imageDropAndPaste', ImageDropAndPaste)
}

export default ImageDropAndPaste