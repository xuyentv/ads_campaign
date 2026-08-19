# AdForge AI

Ứng dụng desktop Windows tạo nội dung Google Ads bằng DeepSeek.

## Chạy khi phát triển

Yêu cầu Node.js 20 trở lên.

```bash
npm install
npm start
```

## Tạo file EXE trên máy Windows

```bash
npm run build
```

Kết quả được lưu trong thư mục `dist/`:

- Bản cài đặt NSIS cho phép chọn thư mục cài đặt.
- Bản portable chạy trực tiếp, không cần cài đặt.

## GitHub Actions

Workflow tại `.github/workflows/build-windows.yml` chạy sau mỗi lần push lên bất kỳ branch nào.

1. Push mã nguồn lên GitHub.
2. Mở tab **Actions** trong repository.
3. Chọn lần chạy **Build Windows EXE** mới nhất.
4. Tải artifact **AdForge-AI-Windows-...** ở cuối trang workflow run.
5. Giải nén artifact để lấy file `.exe` installer và portable.

Artifact của mỗi commit được giữ trong 30 ngày.

## Tạo GitHub Release

Tạo và push tag có tiền tố `v` để workflow tự động đưa các file EXE vào GitHub Releases:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Số phiên bản trong tag nên trùng với trường `version` trong `package.json`.

## Ghi chú bảo mật

API key DeepSeek được lưu trong vùng lưu trữ cục bộ của Electron trên máy người dùng. API key không được đưa vào mã nguồn hoặc GitHub Actions. Bản build hiện chưa ký code-signing certificate, vì vậy Windows SmartScreen có thể hiển thị cảnh báo với ứng dụng mới tải xuống.
