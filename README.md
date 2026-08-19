 # AdForge AI

Website tạo chiến dịch Google Ads Brand Search bằng DeepSeek, tối ưu cho BOFU và xuất dữ liệu Tab-Delimited để sử dụng với Google Ads Editor.

## Website công khai

Website được triển khai bằng Vercel. Sau khi import repository, Vercel sẽ cấp địa chỉ dạng:

`https://ads-campaign-<team>.vercel.app`

Tên miền chính xác được hiển thị trong trang **Project Overview** trên Vercel và có thể thay đổi trong **Settings → Domains**.

## Tính năng

- Cấu hình DeepSeek API và lưu trên trình duyệt người dùng.
- Giao diện tiếng Việt; nội dung quảng cáo đầu ra bằng tiếng Anh.
- Tạo 15 Headlines, 4 Descriptions, Display Paths và Final URL.
- Tạo 6 Sitelinks theo giới hạn ký tự Google Ads.
- Tạo 10 Callouts và 2 Structured Snippets.
- Tự gợi ý Exact Match Brand Keywords theo ý định mua BOFU.
- Nội dung thực tế từ trang là tùy chọn; nếu để trống, hệ thống chuyển sang chế độ chưa xác minh và không được phép tự tạo USP hoặc tuyên bố đã đọc URL.
- Có thể nhập dữ liệu Keyword Planner để lọc theo volume đã xác minh.
- Không tự tạo hoặc suy đoán volume, CPC hay nguồn dữ liệu.
- Hiển thị dữ liệu theo từng hàng và hỗ trợ sao chép Tab-Delimited.
- Hiển thị Audit Log kiểm tra giới hạn ký tự.

## Deploy tự động bằng Vercel

Repository không còn sử dụng GitHub Pages hoặc GitHub Actions để deploy. Vercel kết nối trực tiếp với repository và tự tạo deployment sau mỗi lần push.

### Thiết lập lần đầu

1. Truy cập [Vercel](https://vercel.com/) và đăng nhập bằng GitHub.
2. Chọn **Add New → Project** rồi import repository `ads_campaign`.
3. Trong phần cấu hình project, chọn **Framework Preset: Other**.
4. Giữ **Root Directory** là thư mục gốc repository.
5. Không nhập Build Command, Output Directory hoặc Install Command vì đây là website tĩnh.
6. Chọn **Deploy**.

Sau lần đầu, mỗi push vào branch `main` sẽ tự động tạo Production Deployment. Push vào branch khác hoặc Pull Request sẽ tạo Preview Deployment riêng.

Cấu hình Vercel nằm tại `vercel.json`. Project không yêu cầu biến môi trường phía Vercel vì DeepSeek API key do từng người dùng nhập và lưu cục bộ trong trình duyệt.

### Tắt GitHub Pages cũ

Nếu GitHub Pages đã từng được bật, mở repository trên GitHub, vào **Settings → Pages**, rồi chọn **Unpublish site** để ngừng website cũ. Workflow GitHub Pages đã được xóa khỏi mã nguồn.

## Chạy local

Có thể mở trực tiếp `index.html`, hoặc chạy một static server:

```bash
python -m http.server 8080
```

Sau đó mở `http://localhost:8080`.

## Bảo mật

DeepSeek API key được lưu trong `localStorage` của trình duyệt và gửi trực tiếp từ trình duyệt đến endpoint đã cấu hình. Không commit API key vào repository. Chỉ sử dụng website trên thiết bị và repository đáng tin cậy.

## Giới hạn dữ liệu

Website không có quyền truy cập Google Keyword Planner, SEMrush hoặc Ahrefs. Nếu không cung cấp dữ liệu nghiên cứu, hệ thống chỉ tạo keyword ideas và đánh dấu rõ là chưa xác minh volume/CPC.

Nội dung nguồn từ trang sản phẩm là tùy chọn. Khi có nội dung nguồn, AI dùng nội dung đó để xác minh USP. Khi để trống, hệ thống đánh dấu nguồn là chưa xác minh, không tuyên bố đã duyệt URL và yêu cầu AI không tự tạo USP hoặc dữ kiện sản phẩm. Có thể bổ sung các dữ kiện đã biết trong trường ngữ cảnh bổ sung.
